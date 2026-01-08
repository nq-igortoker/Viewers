/**
 * Incremental Handoff Utility for CreateReport Integration (Issue #21)
 *
 * This utility enables OHIF to send viewport images incrementally to CreateReport
 * via postMessage, one image per button click. CreateReport collects the images
 * and the user manually triggers report generation.
 *
 * Key differences from legacy handoffToCreateReport.ts:
 * - No API calls (no /api/generate-report)
 * - Uses CR_ADD_IMAGE message type instead of CR_HANDOFF_REPORT
 * - Stateful: tracks open tab and image count across clicks
 * - Supports up to MAX_IMAGES (10) per session
 */

// ============================================================================
// Types
// ============================================================================

export interface ImagePayload {
  arrayBuffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
}

export interface SendImageResult {
  success: boolean;
  imageNumber?: number;
  error?: string;
}

// ============================================================================
// Module-level State (persists across clicks)
// ============================================================================

const MAX_IMAGES = 10;

let crWindow: Window | null = null;
let crReady = false;
let imageCount = 0;
let listenerSetup = false;
let currentOrigin: string | null = null;

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
 * @returns The CreateReport window, or null if blocked
 */
export const openOrReuseCreateReportTab = (baseUrl: string): Window | null => {
  // Ensure listener is set up
  setupCRReadyListener(baseUrl);

  // Check if we already have an open tab
  if (crWindow && !crWindow.closed) {
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
 * @param baseUrl - CreateReport base URL (used for targetOrigin)
 * @param payload - The image payload (arrayBuffer, fileName, mimeType)
 * @returns Result indicating success/failure and image number
 */
export const sendViewportImage = async (
  baseUrl: string,
  payload: ImagePayload
): Promise<SendImageResult> => {
  // Validate we have a window
  if (!crWindow || crWindow.closed) {
    return {
      success: false,
      error: 'CreateReport tab is not open. Please click again to open it.',
    };
  }

  // Check limit
  if (!canSendMore()) {
    return {
      success: false,
      error: `Maximum ${MAX_IMAGES} images reached. Please use the images in CreateReport.`,
    };
  }

  // Optional: wait for CR_READY (short timeout, non-blocking)
  if (!crReady) {
    await waitForReady(3000);
  }

  const origin = new URL(baseUrl).origin;

  try {
    // Send the image via postMessage with transferable ArrayBuffer
    crWindow.postMessage(
      {
        type: 'CR_ADD_IMAGE',
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        arrayBuffer: payload.arrayBuffer,
      },
      origin,
      [payload.arrayBuffer] // Transfer the ArrayBuffer (zero-copy)
    );

    imageCount++;

    console.log(`📤 Image ${imageCount}/${MAX_IMAGES} sent to CreateReport`);

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
