import { create } from 'zustand';

import {
  buildCreateReportNoteMessage,
  type CreateReportNoteResult,
  type FindingRef,
  type NoteFailure,
} from '../utils/buildCreateReportMessage';

/**
 * Dictating a finding's note in the viewer (CreateReport#183).
 *
 * The mic next to the chip records here and sends the audio to the
 * CreateReport main window (CR_ADD_NOTE, CreateReport#182), which transcribes
 * it and adds it to that finding's note. The viewer keeps the recording until
 * an answer says it was saved — CreateReport may be closed, busy, or showing
 * another case — and a Try again sends it with the same id, so it is never
 * added twice.
 *
 * Module-level rather than component state: a recording, and one waiting to
 * be delivered, must outlive the toolbar re-rendering or remounting.
 */

/** A recording stops by itself here — the same limit as in CreateReport. */
export const DICTATION_MAX_MS = 90_000;
/** Shorter than this is a click on the button, not a dictation: not sent. */
export const DICTATION_MIN_MS = 800;
/** How long the main window has to say it took the note at all. */
export const ACCEPT_TIMEOUT_MS = 5_000;
/** How long a note it took may take to transcribe and save. */
export const SAVE_TIMEOUT_MS = 120_000;
/** How long the green check stays before the mic is ready again. */
export const SAVED_FLASH_MS = 3_000;

export type DictationStatus =
  /** Ready to record. */
  | 'idle'
  /** Asking for the microphone. */
  | 'starting'
  | 'recording'
  /**
   * Try again found no CreateReport window and is finding or opening one —
   * which may wait on a login there. A press stops waiting.
   */
  | 'connecting'
  /** Sent; waiting for CreateReport to transcribe and save it. */
  | 'sending'
  /** Saved — the green check, for a moment. */
  | 'saved'
  /** Not saved: the recording is kept, with Try again / Discard. */
  | 'undelivered';

/**
 * Why a recording was not delivered: CreateReport's own reason, or
 * - `no-window` — there is no CreateReport window to send it to;
 * - `no-answer` — the window did not answer (closed meanwhile, or too old to
 *   know the message).
 */
export type UndeliveredReason = NoteFailure | 'no-window' | 'no-answer';

/** A recording kept until CreateReport says it was saved. */
export interface KeptRecording {
  clientNoteId: string;
  audio: Blob;
  durationMs: number;
  finding: FindingRef;
  /** The chip's name for it, as it was when recorded. */
  findingName: string;
  studyInstanceUid: string;
}

/** The note as CreateReport saved it — read back under the mic. */
export interface ReadBack {
  findingName: string;
  note: string;
  savedAt: number;
  /** "Add more" records for this finding again. */
  finding: FindingRef;
  studyInstanceUid: string;
}

export interface DictationTarget {
  finding: FindingRef;
  findingName: string;
  studyInstanceUid: string;
}

/** What the store needs from the outside world — injected, for tests. */
export interface DictationDeps {
  getUserMedia: () => Promise<MediaStream>;
  createRecorder: (stream: MediaStream) => MediaRecorder;
  /** False when there is no CreateReport window to send to. */
  send: (message: ReturnType<typeof buildCreateReportNoteMessage>) => boolean;
  /** Whether a CreateReport window is there to send to right now. */
  isConnected: () => boolean;
  /**
   * Finds a CreateReport window again — may open one, so it is called inside
   * the click on Try again. Resolves true once one answered.
   */
  reconnect: () => Promise<boolean>;
  newId: () => string;
  now: () => number;
  /** Tells the findings store the note was saved for this finding. */
  onSaved: (studyInstanceUid: string, findingId: string) => void;
}

export interface DictationState {
  status: DictationStatus;
  /** Whole seconds recorded so far, in ms. */
  elapsedMs: number;
  kept: KeptRecording | null;
  reason: UndeliveredReason | null;
  readBack: ReadBack | null;
  /** Why recording could not start (no microphone, permission refused). */
  micError: 'denied' | 'unavailable' | null;

  /** Starts recording for `target`, or stops the recording in progress. */
  toggle: (target: DictationTarget) => void;
  stop: () => void;
  /** Sends the kept recording again, with the same id. */
  retry: () => void;
  /** Stops waiting for a CreateReport window; the recording stays kept. */
  cancelConnect: () => void;
  discard: () => void;
  dismissReadBack: () => void;
  dismissMicError: () => void;
  /** An answer from CreateReport. */
  receive: (result: CreateReportNoteResult) => void;
  /** Wires the outside world in; done once at start-up (and by tests). */
  configure: (deps: Partial<DictationDeps>) => void;
}

const pickMimeType = (): string | undefined => {
  if (typeof MediaRecorder === 'undefined') {
    return undefined;
  }
  // Chrome and Firefox record WebM, Safari MP4; CreateReport takes both.
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type =>
    MediaRecorder.isTypeSupported(type)
  );
};

const defaultId = (): string =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

let deps: DictationDeps = {
  getUserMedia: () => navigator.mediaDevices.getUserMedia({ audio: true }),
  createRecorder: stream => {
    const mimeType = pickMimeType();
    return new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  },
  send: () => false,
  isConnected: () => false,
  reconnect: () => Promise.resolve(false),
  newId: defaultId,
  now: () => Date.now(),
  onSaved: () => {},
};

// The recording in progress — not state anybody renders.
let recorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let chunks: Blob[] = [];
let startedAt = 0;
let target: DictationTarget | null = null;
let tick: ReturnType<typeof setInterval> | null = null;
/** A second press while the microphone is being asked for calls it off. */
let cancelStart = false;
let answerTimer: ReturnType<typeof setTimeout> | null = null;
let flashTimer: ReturnType<typeof setTimeout> | null = null;
/** Which Try again a reconnect belongs to — one stopped or overtaken is ignored. */
let connectAttempt = 0;

const clearAnswerTimer = () => {
  if (answerTimer) {
    clearTimeout(answerTimer);
  }
  answerTimer = null;
};

const releaseMicrophone = () => {
  if (tick) {
    clearInterval(tick);
  }
  tick = null;
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  recorder = null;
  target = null;
};

export const useCreateReportDictationStore = create<DictationState>()((set, get) => {
  /** Sends the kept recording and waits for its answer. */
  const deliver = async () => {
    const kept = get().kept;
    if (!kept) {
      return;
    }
    clearAnswerTimer();
    // At once, not after the audio is read: the chip must not go on showing a
    // recording that has ended, nor offer Try again while one is on its way.
    set({ status: 'sending', reason: null });
    const message = buildCreateReportNoteMessage({
      clientNoteId: kept.clientNoteId,
      finding: kept.finding,
      studyInstanceUid: kept.studyInstanceUid,
      mimeType: kept.audio.type,
      // A copy: the message transfers its buffer, and the blob is what a
      // Try again sends.
      arrayBuffer: await kept.audio.arrayBuffer(),
      durationMs: kept.durationMs,
    });
    if (get().kept?.clientNoteId !== kept.clientNoteId) {
      return; // Discarded while the audio was being read.
    }
    if (!deps.send(message)) {
      set({ status: 'undelivered', reason: 'no-window' });
      return;
    }
    // No word at all: the window is gone, or predates the message.
    answerTimer = setTimeout(() => {
      if (get().status === 'sending' && get().kept?.clientNoteId === kept.clientNoteId) {
        set({ status: 'undelivered', reason: 'no-answer' });
      }
    }, ACCEPT_TIMEOUT_MS);
  };

  const onStop = (stopped: MediaRecorder) => () => {
    if (recorder !== stopped) {
      return; // A recorder that failed has been dealt with.
    }
    const durationMs = deps.now() - startedAt;
    const mimeType = stopped.mimeType || chunks[0]?.type || '';
    const audio = new Blob(chunks, { type: mimeType });
    const recordedFor = target;
    releaseMicrophone();
    chunks = [];
    // A click, not a dictation: nothing to send, nothing to say.
    if (durationMs < DICTATION_MIN_MS || audio.size === 0 || !recordedFor) {
      set({ status: 'idle', elapsedMs: 0 });
      return;
    }
    set({
      elapsedMs: 0,
      kept: {
        clientNoteId: deps.newId(),
        audio,
        durationMs,
        finding: recordedFor.finding,
        findingName: recordedFor.findingName,
        studyInstanceUid: recordedFor.studyInstanceUid,
      },
    });
    void deliver();
  };

  const start = async (to: DictationTarget) => {
    cancelStart = false;
    target = to;
    set({ status: 'starting', micError: null, readBack: null, reason: null });
    let granted: MediaStream;
    try {
      granted = await deps.getUserMedia();
    } catch (error) {
      target = null;
      if (cancelStart) {
        // Called off before the browser answered: no message about it.
        set({ status: 'idle' });
        return;
      }
      const denied =
        error instanceof DOMException &&
        (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      set({ status: 'idle', micError: denied ? 'denied' : 'unavailable' });
      return;
    }
    if (cancelStart) {
      granted.getTracks().forEach(track => track.stop());
      target = null;
      set({ status: 'idle' });
      return;
    }
    let made: MediaRecorder;
    try {
      made = deps.createRecorder(granted);
    } catch (_error) {
      granted.getTracks().forEach(track => track.stop());
      target = null;
      set({ status: 'idle', micError: 'unavailable' });
      return;
    }
    stream = granted;
    recorder = made;
    chunks = [];
    made.ondataavailable = event => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    made.onstop = onStop(made);
    made.onerror = () => {
      releaseMicrophone();
      chunks = [];
      set({ status: 'idle', elapsedMs: 0, micError: 'unavailable' });
    };
    made.start();
    startedAt = deps.now();
    set({ status: 'recording', elapsedMs: 0 });
    tick = setInterval(() => {
      const elapsed = deps.now() - startedAt;
      if (elapsed >= DICTATION_MAX_MS) {
        get().stop();
      }
      const whole = Math.floor(elapsed / 1000) * 1000;
      if (whole !== get().elapsedMs) {
        set({ elapsedMs: whole });
      }
    }, 200);
  };

  return {
    status: 'idle',
    elapsedMs: 0,
    kept: null,
    reason: null,
    readBack: null,
    micError: null,

    toggle: to => {
      const { status } = get();
      if (status === 'recording' || status === 'starting') {
        get().stop();
        return;
      }
      // A kept recording is decided on first — a new one would replace it;
      // one on its way waits for its answer.
      if (
        status === 'sending' ||
        status === 'connecting' ||
        status === 'undelivered' ||
        get().kept
      ) {
        return;
      }
      if (flashTimer) {
        clearTimeout(flashTimer);
        flashTimer = null;
      }
      void start(to);
    },

    stop: () => {
      if (get().status === 'starting') {
        cancelStart = true;
      }
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
    },

    retry: () => {
      const { kept, status } = get();
      if (!kept || status === 'sending' || status === 'connecting') {
        return;
      }
      if (deps.isConnected()) {
        void deliver();
        return;
      }
      // No CreateReport window: found again — or opened, which has to happen
      // here, inside the click — before the recording goes to it.
      const attempt = ++connectAttempt;
      const reconnecting = deps.reconnect();
      set({ status: 'connecting', reason: null });
      void reconnecting.then(connected => {
        if (attempt !== connectAttempt || get().status !== 'connecting') {
          return; // Stopped waiting meanwhile.
        }
        if (connected) {
          void deliver();
        } else {
          set({ status: 'undelivered', reason: 'no-window' });
        }
      });
    },

    cancelConnect: () => {
      if (get().status !== 'connecting') {
        return;
      }
      connectAttempt++;
      set({ status: 'undelivered', reason: 'no-window' });
    },

    discard: () => {
      // On its way: what it says when it lands decides. Waiting for a window
      // is stopped first (cancelConnect), then it can be discarded.
      if (get().status === 'sending' || get().status === 'connecting') {
        return;
      }
      clearAnswerTimer();
      set({ kept: null, status: 'idle', reason: null });
    },

    dismissReadBack: () => set({ readBack: null }),
    dismissMicError: () => set({ micError: null }),

    receive: result => {
      const kept = get().kept;
      // An answer for another recording — an earlier one, discarded since.
      if (!kept || result.clientNoteId !== kept.clientNoteId) {
        return;
      }
      if (result.status === 'transcribing') {
        // Taken: now it may take as long as a transcription takes. Also when
        // it comes after the window was given up on — CreateReport may first
        // have had to open the case — so it is on its way after all.
        if (get().status === 'undelivered' && get().reason !== 'no-answer') {
          return;
        }
        set({ status: 'sending', reason: null });
        clearAnswerTimer();
        answerTimer = setTimeout(() => {
          if (get().status === 'sending' && get().kept?.clientNoteId === kept.clientNoteId) {
            set({ status: 'undelivered', reason: 'no-answer' });
          }
        }, SAVE_TIMEOUT_MS);
        return;
      }
      clearAnswerTimer();
      if (result.status === 'failed') {
        set({ status: 'undelivered', reason: result.reason });
        return;
      }
      deps.onSaved(kept.studyInstanceUid, kept.finding.id);
      set({
        status: 'saved',
        kept: null,
        reason: null,
        readBack: {
          findingName: kept.findingName,
          note: result.note,
          savedAt: deps.now(),
          finding: kept.finding,
          studyInstanceUid: kept.studyInstanceUid,
        },
      });
      flashTimer = setTimeout(() => {
        flashTimer = null;
        if (get().status === 'saved') {
          set({ status: 'idle' });
        }
      }, SAVED_FLASH_MS);
    },

    configure: overrides => {
      deps = { ...deps, ...overrides };
    },
  };
});

// Leaving the viewer — a reload, a click on another study in the worklist —
// would lose a recording in progress or one not delivered yet: the browser
// asks first. Keeping it across a reload is out of scope (CreateReport#183).
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', event => {
    const { status, kept } = useCreateReportDictationStore.getState();
    if (status === 'recording' || status === 'starting' || kept) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}

/** Whether a failure is worth sending the same recording again for. */
export const canRetry = (reason: UndeliveredReason | null): boolean => reason !== 'rejected';
