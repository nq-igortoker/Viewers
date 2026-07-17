/**
 * Incremental Handoff Utility for CreateReport Integration (Issue #21)
 *
 * This utility enables OHIF to send viewport images incrementally to CreateReport
 * via postMessage, one image per button click. CreateReport collects the images
 * and the user manually triggers report generation.
 *
 * Two delivery channels (CreateReport#97):
 * - Opener channel (preferred): when this viewer was opened by the CreateReport
 *   main window, a CR_VIEWER_READY → CR_HELLO handshake establishes the app's
 *   window + origin, and images go straight into that window — no new tab.
 * - Tab channel (fallback): the legacy flow opens `<baseUrl>/handoff` in a
 *   named tab and posts there. Used when there is no (valid) opener.
 *
 * Messages are CR_ADD_IMAGE v2: screenshot + `dicomRef` (Study/Series/SOP UID)
 * + a curated `meta` excerpt. v1 receivers simply ignore the extra fields.
 */

import type { DicomRef, DicomMetaExcerpt } from './getViewportDicomContext';

// ============================================================================
// Types
// ============================================================================

export interface ImagePayload {
  arrayBuffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
  dicomRef?: DicomRef;
  meta?: DicomMetaExcerpt;
}

export interface SendImageResult {
  success: boolean;
  imageNumber?: number;
  error?: string;
}

/**
 * Delivery-channel policy (CreateReport#99):
 * - 'auto'   — main-window channel on desktop, /handoff tab on mobile
 * - 'window' — always prefer the main-window channel when connected
 * - 'tab'    — always use the /handoff tab
 */
export type HandoffMode = 'auto' | 'window' | 'tab';

// ============================================================================
// Module-level State (persists across clicks)
// ============================================================================

const MAX_IMAGES = 10;

let crWindow: Window | null = null;
let crReady = false;
let imageCount = 0;
let listenerSetup = false;
let currentOrigin: string | null = null;

// Opener channel state (CreateReport#97): the app window that opened this
// viewer, established via the CR_VIEWER_READY → CR_HELLO handshake.
let appWindow: Window | null = null;
let appOrigin: string | null = null;
let handshakeSetup = false;

// The study images are currently being sent for — the per-session image
// counter resets when the user moves on to another study.
let currentStudyUid: string | null = null;

// ============================================================================
// Opener Handshake (CreateReport#97)
// ============================================================================

/**
 * Establishes the direct channel to the CreateReport main window, if this
 * viewer was opened by one. Idempotent; call once at app init.
 *
 * Flow: viewer posts CR_VIEWER_READY to its opener (no payload, so '*' is
 * safe). The app answers CR_HELLO; `event.origin` — validated against the
 * allowlist — tells us where to target subsequent CR_ADD_IMAGE posts, since
 * `opener.origin` is not readable cross-origin.
 *
 * @param allowedAppOrigins - Origins CreateReport may answer from
 */
export const initAppHandshake = (allowedAppOrigins: string[]): void => {
  if (handshakeSetup) {
    return;
  }
  if (!window.opener) {
    // Standalone viewer (bookmark, direct URL) — tab channel will be used
    return;
  }
  handshakeSetup = true;

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.data?.type !== 'CR_HELLO') {
      return;
    }
    if (!allowedAppOrigins.includes(event.origin)) {
      console.warn(`⚠️ CR_HELLO from unexpected origin ignored: ${event.origin}`);
      return;
    }
    appWindow = event.source as Window;
    appOrigin = event.origin;
    console.log('🤝 CreateReport main window connected:', appOrigin);
  });

  try {
    window.opener.postMessage({ type: 'CR_VIEWER_READY' }, '*');
  } catch (error) {
    console.warn('Failed to announce viewer to opener:', error);
  }
};

/** True when the direct channel to the CreateReport main window is usable. */
export const hasAppConnection = (): boolean => {
  return !!appWindow && !appWindow.closed && !!appOrigin;
};

/**
 * Phone/tablet heuristic (CreateReport#99): coarse pointer + small viewport.
 * There is no side-by-side window layout on these devices, so images sent to
 * the main window would land in an invisible background tab.
 */
export const isMobileDevice = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(pointer: coarse) and (max-width: 1024px)').matches
  );
};

/**
 * Resolves which channel to use for the next send (CreateReport#99).
 * The tab channel is the answer whenever this returns false.
 */
export const shouldUseAppChannel = (mode: HandoffMode = 'auto'): boolean => {
  if (mode === 'tab') {
    return false;
  }
  if (mode === 'window') {
    return hasAppConnection();
  }
  return hasAppConnection() && !isMobileDevice();
};

// ============================================================================
// CR_READY Listener Setup
// ============================================================================

/**
 * Sets up the CR_READY message listener (idempotent).
 * Should be called once when the app initializes or on first use.
 *
 * @param baseUrl - CreateReport base URL (used for origin validation)
 */
export const setupCRReadyListener = (baseUrl: string): void => {
  const origin = new URL(baseUrl).origin;

  // If already set up for the same origin, skip
  if (listenerSetup && currentOrigin === origin) {
    return;
  }

  // Update origin tracking
  currentOrigin = origin;

  const handler = (event: MessageEvent) => {
    // Validate origin
    if (event.origin !== currentOrigin) {
      return;
    }

    if (event.data?.type === 'CR_READY') {
      console.log('✅ CreateReport is ready (CR_READY received)');
      crReady = true;
    }
  };

  window.addEventListener('message', handler);
  listenerSetup = true;
};

// ============================================================================
// Tab Management
// ============================================================================

/**
 * Opens CreateReport in a new tab or reuses an existing one.
 * MUST be called synchronously within a user click handler to avoid popup blockers.
 *
 * @param baseUrl - CreateReport base URL
 * @param options - focus: bring an already-open tab to the foreground
 *   (CreateReport#99, mobile). Uses `window.open('', name)` — an empty URL
 *   focuses the named tab WITHOUT re-navigating, so collected images survive.
 * @returns The CreateReport window, or null if blocked
 */
export const openOrReuseCreateReportTab = (
  baseUrl: string,
  options?: { focus?: boolean }
): Window | null => {
  // Ensure listener is set up
  setupCRReadyListener(baseUrl);

  // Check if we already have an open tab
  if (crWindow && !crWindow.closed) {
    if (options?.focus) {
      try {
        window.open('', 'createreport');
        crWindow.focus();
      } catch {
        // Focus is best effort — some browsers refuse it outside a gesture
      }
    }
    // Tab is still open, reuse it
    return crWindow;
  }

  // Open a new tab (must be synchronous in click handler!)
  const handoffUrl = `${baseUrl}/handoff`;
  crWindow = window.open(handoffUrl, 'createreport');

  if (crWindow) {
    // Reset state for new session
    crReady = false;
    imageCount = 0;
    console.log(`📂 Opened CreateReport tab: ${handoffUrl}`);
  } else {
    console.warn('❌ Popup was blocked by the browser');
  }

  return crWindow;
};

// ============================================================================
// Image Sending
// ============================================================================

/**
 * Checks if more images can be sent (respects MAX_IMAGES limit).
 */
export const canSendMore = (): boolean => {
  return imageCount < MAX_IMAGES;
};

/**
 * Returns the current image count.
 */
export const getImageCount = (): number => {
  return imageCount;
};

/**
 * Returns the maximum allowed images.
 */
export const getMaxImages = (): number => {
  return MAX_IMAGES;
};

/**
 * Waits for CR_READY with a timeout.
 * Resolves to true if ready, false if timeout.
 *
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 */
export const waitForReady = (timeoutMs: number = 5000): Promise<boolean> => {
  return new Promise(resolve => {
    if (crReady) {
      resolve(true);
      return;
    }

    const start = Date.now();
    const interval = setInterval(() => {
      if (crReady) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        console.warn(`⏱️ CR_READY timeout after ${timeoutMs}ms, proceeding anyway`);
        resolve(false);
      }
    }, 100);
  });
};

/**
 * Sends a viewport image to CreateReport via postMessage.
 *
 * Prefers the direct channel to the app's main window (opener handshake,
 * CreateReport#97); falls back to the /handoff tab opened by
 * openOrReuseCreateReportTab(). v2 payload fields (dicomRef, meta) ride along
 * on both channels — v1 receivers ignore them.
 *
 * @param baseUrl - CreateReport base URL (used for the tab channel's targetOrigin)
 * @param payload - The image payload (arrayBuffer, fileName, mimeType, dicomRef?, meta?)
 * @param mode - delivery-channel policy (CreateReport#99), default 'auto'
 * @returns Result indicating success/failure and image number
 */
export const sendViewportImage = async (
  baseUrl: string,
  payload: ImagePayload,
  mode: HandoffMode = 'auto'
): Promise<SendImageResult> => {
  const useAppChannel = shouldUseAppChannel(mode);

  // Tab channel needs its window (opened synchronously in the click handler)
  if (!useAppChannel && (!crWindow || crWindow.closed)) {
    return {
      success: false,
      error: 'CreateReport tab is not open. Please click again to open it.',
    };
  }

  // Moving on to a different study starts a fresh image session
  const studyUid = payload.dicomRef?.studyInstanceUid || null;
  if (studyUid && currentStudyUid && studyUid !== currentStudyUid) {
    imageCount = 0;
    console.log('🔄 Study changed — image counter reset');
  }
  if (studyUid) {
    currentStudyUid = studyUid;
  }

  // Check limit
  if (!canSendMore()) {
    return {
      success: false,
      error: `Maximum ${MAX_IMAGES} images reached. Please use the images in CreateReport.`,
    };
  }

  // Tab channel only: wait for CR_READY (the app channel is handshake-proven)
  if (!useAppChannel && !crReady) {
    await waitForReady(3000);
  }

  const targetWindow = useAppChannel ? appWindow! : crWindow!;
  const targetOrigin = useAppChannel ? appOrigin! : new URL(baseUrl).origin;

  try {
    // Send the image via postMessage with transferable ArrayBuffer
    targetWindow.postMessage(
      {
        type: 'CR_ADD_IMAGE',
        version: 2,
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        arrayBuffer: payload.arrayBuffer,
        dicomRef: payload.dicomRef,
        meta: payload.meta,
      },
      targetOrigin,
      [payload.arrayBuffer] // Transfer the ArrayBuffer (zero-copy)
    );

    imageCount++;

    console.log(
      `📤 Image ${imageCount}/${MAX_IMAGES} sent to CreateReport (${useAppChannel ? 'main window' : 'handoff tab'})`
    );

    return {
      success: true,
      imageNumber: imageCount,
    };
  } catch (error) {
    console.error('Failed to send image to CreateReport:', error);
    return {
      success: false,
      error: (error as Error).message || 'Failed to send image',
    };
  }
};

// ============================================================================
// Session Reset (for testing or explicit reset)
// ============================================================================

/**
 * Resets the session state. Useful for testing or when starting fresh.
 * Does NOT close the CreateReport tab.
 */
export const resetSession = (): void => {
  crReady = false;
  imageCount = 0;
  console.log('🔄 CreateReport session state reset');
};

/**
 * Closes the CreateReport tab and resets all state.
 */
export const closeAndReset = (): void => {
  if (crWindow && !crWindow.closed) {
    crWindow.close();
  }
  crWindow = null;
  crReady = false;
  imageCount = 0;
  console.log('🔄 CreateReport tab closed and session reset');
};

// ============================================================================
// Exports
// ============================================================================

export default {
  initAppHandshake,
  hasAppConnection,
  isMobileDevice,
  shouldUseAppChannel,
  setupCRReadyListener,
  openOrReuseCreateReportTab,
  canSendMore,
  getImageCount,
  getMaxImages,
  waitForReady,
  sendViewportImage,
  resetSession,
  closeAndReset,
};
