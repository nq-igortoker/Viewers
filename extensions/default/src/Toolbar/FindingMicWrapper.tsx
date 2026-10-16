import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip, TooltipTrigger, TooltipContent } from '@ohif/ui-next';

import {
  useCreateReportDictationStore,
  canRetry,
  type DictationTarget,
  type UndeliveredReason,
} from '../stores/useCreateReportDictationStore';
import { useCreateReportFindingsStore, findingLabel } from '../stores/useCreateReportFindingsStore';
import {
  canDictate,
  hasAppConnection,
  onAppConnectionChange,
} from '../utils/createReportIncrementalHandoff';
import { isCreateReportConfigured } from '../utils/isCreateReportConfigured';

/**
 * The mic next to the finding chip (CreateReport#183): dictates a note for the
 * finding the chip shows, so the radiologist does not have to leave the images.
 *
 * The states are the mockups' (*Viewer · Mic states*, *Viewer · Note read
 * back*): ready, recording (red, running time, stops at 1:30), transcribing,
 * saved (a check, then the note read back), not delivered (amber, recording
 * kept, Try again / Discard) and not available (no CreateReport window).
 * The note is read back, not edited: text is changed in CreateReport.
 */

// The mockup's colours, which follow the viewer's own toolbar palette.
const LINE = '#2a4a8a';
const TEXT = '#e6eefc';
const TEXT2 = '#8fb4e8';
const MENU = '#041c49';
const RED = '#ef4444';
const GREEN = '#34d399';
const AMBER = '#fbbf24';

export const micShortcutLabel = (): string =>
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
    ? '⌥M'
    : 'Alt+M';

const clock = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const timeOfDay = (at: number): string =>
  new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

const svg = (children: React.ReactNode, size = 14, extra: React.SVGProps<SVGSVGElement> = {}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...extra}
  >
    {children}
  </svg>
);
const MicIcon = () =>
  svg(
    <>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
    </>
  );
const StopIcon = () =>
  svg(
    <rect
      x="5"
      y="5"
      width="14"
      height="14"
      rx="2"
    />,
    12,
    { fill: 'currentColor', stroke: 'none' }
  );
const SpinIcon = () =>
  svg(<path d="M21 12a9 9 0 1 1-6.219-8.56" />, 14, { className: 'animate-spin' });
const CheckIcon = ({ color }: { color?: string }) =>
  svg(<path d="M20 6 9 17l-5-5" />, 14, { strokeWidth: 2.4, ...(color ? { stroke: color } : {}) });
const WarnIcon = () =>
  svg(
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  );

/** What the not-delivered popover says, by reason. */
const undeliveredText = (
  reason: UndeliveredReason | null,
  kept: string,
  finding: string
): string => {
  switch (reason) {
    case 'not-open-case':
      return `This study is not the case open in CreateReport. Your recording (${kept}) is kept. Open the case in CreateReport and try again.`;
    case 'unknown-study':
      return `No case in CreateReport shows this study. Your recording (${kept}) is kept. Open the study from the CreateReport worklist and try again.`;
    case 'transcription':
      return `CreateReport could not transcribe your recording (${kept}) this time — the service is busy or failed. It is kept: try again.`;
    case 'no-answer':
      return `CreateReport did not answer. Your recording (${kept}) is kept. Check that CreateReport is open and try again.`;
    case 'session':
      return `CreateReport's login has expired. Your recording (${kept}) is kept. Log in again in CreateReport and try again.`;
    case 'nothing-heard':
      return `Nothing was heard in your recording (${kept}). It is kept: try again if you did speak, or discard it.`;
    case 'too-long':
      return `The note for ${finding} would be too long. Your recording (${kept}) is kept. Shorten the note in CreateReport and try again.`;
    case 'rejected':
      return `CreateReport could not transcribe this recording (${kept}). Discard it and dictate again.`;
    case 'no-window':
      return `CreateReport is not open. Your recording (${kept}) is kept — Try again opens CreateReport and sends it.`;
    default:
      return `Your recording (${kept}) could not be saved in CreateReport. It is kept: try again.`;
  }
};

const btnStyle = (overrides: React.CSSProperties = {}): React.CSSProperties => ({
  height: 24,
  minWidth: 32,
  padding: '0 8px',
  borderRadius: 6,
  border: `1px solid ${LINE}`,
  background: 'transparent',
  color: TEXT,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  fontSize: 12,
  fontWeight: 500,
  ...overrides,
});

/** A popover under the mic, in a portal: the toolbar clips what overflows it. */
function MicPopover({
  anchor,
  onClose,
  children,
  label,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
  label: string;
}) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!anchor) {
      return;
    }
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const width = 330;
      setPosition({
        top: rect.bottom + 9,
        left: Math.max(8, Math.min(rect.left - 12, window.innerWidth - width - 8)),
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor]);

  // Closed by Escape or a click elsewhere — not by a click on the mic, which
  // has its own say. The Escape is the popover's: caught before the viewer's
  // hotkeys, it does not also cancel a measurement or reject a preview.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.stopPropagation();
      onClose();
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (boxRef.current?.contains(target) || anchor?.contains(target)) {
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [anchor, onClose]);

  if (!position) {
    return null;
  }
  return createPortal(
    <div
      ref={boxRef}
      role="dialog"
      aria-label={label}
      data-cy="cr-mic-popover"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: 330,
        zIndex: 1000,
        background: MENU,
        border: `1px solid ${LINE}`,
        borderRadius: 10,
        padding: '12px 14px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
        fontSize: 13,
        color: TEXT,
      }}
    >
      {children}
    </div>,
    document.body
  );
}

const popTitle: React.CSSProperties = {
  margin: '0 0 6px',
  fontSize: 12,
  fontWeight: 600,
  color: TEXT2,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};
const popActs: React.CSSProperties = { display: 'flex', gap: 8, marginTop: 10 };
const popBtn = btnStyle({ height: 28, padding: '0 12px' });

/** Is there a CreateReport window to send to — asked again as it can close. */
function useAppConnection(): boolean {
  const [connected, setConnected] = useState(hasAppConnection);
  useEffect(() => {
    const check = () => setConnected(hasAppConnection());
    const unsubscribe = onAppConnectionChange(check);
    // A window closing is not an event another window hears.
    const poll = setInterval(check, 1500);
    return () => {
      unsubscribe();
      clearInterval(poll);
    };
  }, []);
  return connected;
}

/**
 * The finding the mic records for: the chip's, or the Finding 1 the chip
 * shows before any is chosen — created the moment a recording starts, as a
 * capture would create it.
 */
export const currentDictationTarget = (): DictationTarget | null => {
  const findings = useCreateReportFindingsStore.getState();
  const studyInstanceUid = findings.studyInstanceUid;
  if (!studyInstanceUid) {
    return null;
  }
  let finding = findings.findings.find(f => f.id === findings.activeFindingId);
  if (!finding) {
    finding = findings.ensureFirstFinding();
    findings.setActiveFinding(finding.id);
  }
  return {
    finding: { id: finding.id, index: finding.index, kind: finding.kind, label: finding.label },
    findingName: findingLabel(finding),
    studyInstanceUid,
  };
};

export default function FindingMicWrapper({ disabled }: { disabled?: boolean }) {
  const status = useCreateReportDictationStore(state => state.status);
  const elapsedMs = useCreateReportDictationStore(state => state.elapsedMs);
  const kept = useCreateReportDictationStore(state => state.kept);
  const reason = useCreateReportDictationStore(state => state.reason);
  const readBack = useCreateReportDictationStore(state => state.readBack);
  const micError = useCreateReportDictationStore(state => state.micError);
  const { toggle, retry, discard, dismissReadBack, dismissMicError } =
    useCreateReportDictationStore.getState();

  const findings = useCreateReportFindingsStore(state => state.findings);
  const activeFindingId = useCreateReportFindingsStore(state => state.activeFindingId);
  const studyInstanceUid = useCreateReportFindingsStore(state => state.studyInstanceUid);
  const connected = useAppConnection();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [showUndelivered, setShowUndelivered] = useState(true);

  // A new failure opens its popover again.
  useEffect(() => {
    if (status === 'undelivered') {
      setShowUndelivered(true);
    }
  }, [status, reason]);

  const active = findings.find(f => f.id === activeFindingId);
  const findingName = active ? findingLabel(active) : 'Finding 1';
  const shortcut = micShortcutLabel();

  const onClick = useCallback(() => {
    const state = useCreateReportDictationStore.getState();
    if (state.status === 'connecting') {
      // Stops waiting for CreateReport; the recording stays kept.
      state.cancelConnect();
      return;
    }
    if (state.status === 'undelivered') {
      setShowUndelivered(true);
      return;
    }
    const target = currentDictationTarget();
    if (target) {
      toggle(target);
    }
  }, [toggle]);

  // Deployments without a `createReport` block have nowhere to send a note.
  if (!isCreateReportConfigured()) {
    return null;
  }

  // Recording or sending carries on even if the window went away meanwhile —
  // what it says when it ends is the delivery's business.
  const busy = status !== 'idle' && status !== 'saved';
  // Not available only to a viewer that never had a CreateReport window (it
  // was opened on its own). One whose window went away still records: the
  // recording is kept, and Try again finds or opens CreateReport.
  // `connected` re-renders this as the window comes and goes.
  const unavailable = !(connected || canDictate()) && !busy;
  const off = unavailable || !studyInstanceUid || (disabled && !busy);

  let content: React.ReactNode = <MicIcon />;
  let style = btnStyle();
  let label = `Dictate a note for ${findingName}`;
  let after: React.ReactNode = null;
  if (status === 'recording') {
    content = <StopIcon />;
    style = btnStyle({
      background: RED,
      borderColor: RED,
      color: '#fff',
      boxShadow: '0 0 0 3px rgba(239,68,68,0.30)',
    });
    label = 'Stop recording';
    after = (
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontSize: 12,
          fontWeight: 600,
          color: '#fca5a5',
        }}
        aria-hidden="true"
      >
        {clock(elapsedMs)}
      </span>
    );
  } else if (status === 'starting') {
    content = <SpinIcon />;
    label = 'Waiting for the microphone — press again to cancel';
  } else if (status === 'connecting') {
    content = <SpinIcon />;
    style = btnStyle({ borderColor: AMBER, color: AMBER });
    label = 'Waiting for CreateReport — press to stop waiting';
    after = <span style={{ fontSize: 12, color: TEXT2 }}>Opening CreateReport…</span>;
  } else if (status === 'sending') {
    content = <SpinIcon />;
    label = 'Transcribing';
    after = <span style={{ fontSize: 12, color: TEXT2 }}>Transcribing…</span>;
  } else if (status === 'saved') {
    content = <CheckIcon />;
    style = btnStyle({ borderColor: GREEN, color: GREEN });
    label = `Saved to ${readBack?.findingName ?? findingName}`;
    after = <span style={{ fontSize: 12, color: GREEN }}>Saved</span>;
  } else if (status === 'undelivered') {
    content = <WarnIcon />;
    style = btnStyle({ borderColor: AMBER, color: AMBER });
    label = 'Not delivered — show the recording';
  }
  if (off && status === 'idle') {
    style = { ...style, opacity: 0.38 };
  }
  const tooltip = unavailable
    ? 'Open this study from the CreateReport worklist to dictate'
    : `${label} (${shortcut})`;

  return (
    <div
      className="flex h-10 items-center gap-1.5 px-1.5"
      data-cy="cr-finding-mic"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span ref={anchorRef}>
            <button
              type="button"
              style={style}
              onClick={onClick}
              // As in the mockup: nothing to press while it is on its way.
              disabled={(off && status === 'idle') || status === 'sending'}
              aria-label={label}
              aria-pressed={status === 'recording' || status === 'starting'}
            >
              {content}
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltip}</TooltipContent>
      </Tooltip>
      {after}

      {status === 'undelivered' && kept && showUndelivered && (
        <MicPopover
          anchor={anchorRef.current}
          onClose={() => setShowUndelivered(false)}
          label="Not delivered to CreateReport"
        >
          <h6 style={popTitle}>Not delivered to CreateReport</h6>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            {undeliveredText(reason, clock(kept.durationMs), kept.findingName)}
          </p>
          <div style={popActs}>
            {canRetry(reason) && (
              <button
                type="button"
                style={popBtn}
                onClick={retry}
              >
                Try again
              </button>
            )}
            <button
              type="button"
              style={popBtn}
              onClick={discard}
            >
              Discard
            </button>
          </div>
        </MicPopover>
      )}

      {readBack && !busy && (
        <MicPopover
          anchor={anchorRef.current}
          onClose={dismissReadBack}
          label="Note saved to CreateReport"
        >
          <h6 style={popTitle}>
            <CheckIcon color={GREEN} />
            {readBack.findingName} · saved to CreateReport {timeOfDay(readBack.savedAt)}
          </h6>
          <p style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{readBack.note}</p>
          <div style={popActs}>
            <button
              type="button"
              style={popBtn}
              disabled={!connected}
              onClick={() =>
                toggle({
                  finding: readBack.finding,
                  findingName: readBack.findingName,
                  studyInstanceUid: readBack.studyInstanceUid,
                })
              }
            >
              <MicIcon />
              Add more
            </button>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: TEXT2 }}>
            To change the text, edit it in CreateReport.
          </p>
        </MicPopover>
      )}

      {micError && (
        <MicPopover
          anchor={anchorRef.current}
          onClose={dismissMicError}
          label="Microphone not available"
        >
          <h6 style={popTitle}>Microphone not available</h6>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            {micError === 'denied'
              ? 'Access to the microphone was refused. Allow it for this site in the browser, then try again.'
              : 'No microphone could be used. Check that one is connected, then try again.'}
          </p>
          <div style={popActs}>
            <button
              type="button"
              style={popBtn}
              onClick={dismissMicError}
            >
              Close
            </button>
          </div>
        </MicPopover>
      )}
    </div>
  );
}

export { FindingMicWrapper };
