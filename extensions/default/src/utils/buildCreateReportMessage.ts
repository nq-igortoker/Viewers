/**
 * Builds the `CR_ADD_IMAGE` postMessage payload for CreateReport.
 *
 * Kept separate from the transport (createReportIncrementalHandoff.ts) so the
 * wire format can be tested without a window: this function is pure.
 *
 * Versioning (CreateReport#26): v3 adds a single field, `finding`, naming the
 * finding the image belongs to. A message without a finding stays v2-shaped,
 * so nothing changes for viewers or receivers that do not use the chip.
 */

import type { DicomRef, DicomMetaExcerpt } from './getViewportDicomContext';

/**
 * `lesion` is the historical name for what the UI now calls a Finding
 * (CreateReport#144). It stays on the wire: renaming it would need a
 * coordinated viewer/app release and a CreateReport data migration.
 */
export type FindingKind = 'lesion' | 'overview';

/**
 * The finding an image was captured for, as it crosses the window boundary.
 *
 * `id` is stable only within one viewer session — CreateReport maps it to its
 * own case-scoped ids and is the source of truth for regrouping.
 */
export interface FindingRef {
  id: string;
  index: number;
  kind: FindingKind;
  label?: string;
}

export interface CreateReportImagePayload {
  arrayBuffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
  dicomRef?: DicomRef;
  meta?: DicomMetaExcerpt;
  finding?: FindingRef;
}

interface CreateReportAddImageBase {
  type: 'CR_ADD_IMAGE';
  fileName: string;
  mimeType: string;
  arrayBuffer: ArrayBuffer;
  dicomRef?: DicomRef;
  meta?: DicomMetaExcerpt;
}

/** No finding named: the message stays exactly as it was before the chip. */
export interface CreateReportAddImageV2 extends CreateReportAddImageBase {
  version: 2;
  finding?: never;
}

/** A finding is what v3 *is*, so the field is required rather than optional. */
export interface CreateReportAddImageV3 extends CreateReportAddImageBase {
  version: 3;
  finding: FindingRef;
}

/**
 * Discriminated on `version`, mirroring `CrAddImageV2`/`CrAddImageV3` in
 * CreateReport's `src/types/findings.ts`. A single type with `version: 2 | 3`
 * and an optional `finding` would let the two files disagree about the one
 * field the contract exists for.
 */
export type CreateReportAddImageMessage = CreateReportAddImageV2 | CreateReportAddImageV3;

export const buildCreateReportMessage = (
  payload: CreateReportImagePayload
): CreateReportAddImageMessage => {
  const message: CreateReportAddImageV2 = {
    type: 'CR_ADD_IMAGE',
    version: 2,
    fileName: payload.fileName,
    mimeType: payload.mimeType,
    arrayBuffer: payload.arrayBuffer,
    dicomRef: payload.dicomRef,
    meta: payload.meta,
  };

  if (!payload.finding) {
    return message;
  }

  const { id, index, kind, label } = payload.finding;

  return {
    ...message,
    version: 3,
    finding: {
      id,
      index,
      kind,
      // An absent label is omitted rather than sent as undefined: the receiver
      // falls back to the running number.
      ...(label === undefined ? {} : { label }),
    },
  };
};

// ============================================================================
// CR_ADD_NOTE / CR_NOTE_RESULT (CreateReport#182, #183)
// ============================================================================

/**
 * A dictation recorded here for the finding the chip shows (CreateReport#183).
 * The viewer has no login of its own and cannot call the app's API, so the
 * audio goes to the CreateReport main window, which transcribes it with its
 * own session and adds it to that finding's note. Mirrors `CrAddNoteMessage`
 * in CreateReport's `src/types/findings.ts`.
 */
export interface CreateReportAddNoteMessage {
  type: 'CR_ADD_NOTE';
  version: 1;
  /** This recording's id: a resend after a lost answer is added only once. */
  clientNoteId: string;
  finding: FindingRef;
  /** Required: the note goes to the open case only if it shows this study. */
  dicomRef: { studyInstanceUid: string };
  mimeType: string;
  arrayBuffer: ArrayBuffer;
  durationMs: number;
}

export const buildCreateReportNoteMessage = (note: {
  clientNoteId: string;
  finding: FindingRef;
  studyInstanceUid: string;
  mimeType: string;
  arrayBuffer: ArrayBuffer;
  durationMs: number;
}): CreateReportAddNoteMessage => {
  const { id, index, kind, label } = note.finding;
  return {
    type: 'CR_ADD_NOTE',
    version: 1,
    clientNoteId: note.clientNoteId,
    finding: { id, index, kind, ...(label === undefined ? {} : { label }) },
    dicomRef: { studyInstanceUid: note.studyInstanceUid },
    mimeType: note.mimeType,
    arrayBuffer: note.arrayBuffer,
    durationMs: Math.round(note.durationMs),
  };
};

/** Why CreateReport did not save a note — `NoteFailure` in its contract. */
export type NoteFailure =
  | 'not-open-case'
  | 'unknown-study'
  | 'nothing-heard'
  | 'transcription'
  | 'rejected'
  | 'session'
  | 'too-long'
  | 'finding-deleted'
  | 'failed';

const NOTE_FAILURES: readonly NoteFailure[] = [
  'not-open-case',
  'unknown-study',
  'nothing-heard',
  'transcription',
  'rejected',
  'session',
  'too-long',
  'finding-deleted',
  'failed',
];

export type CreateReportNoteResult =
  | { clientNoteId: string; status: 'transcribing' }
  | { clientNoteId: string; status: 'saved'; note: string }
  | { clientNoteId: string; status: 'failed'; reason: NoteFailure };

/**
 * A `CR_NOTE_RESULT` as it arrived, or null when it is not one. An unknown
 * failure reason reads as `failed` — worth a retry, never a silent success.
 */
export const parseNoteResult = (data: unknown): CreateReportNoteResult | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const message = data as Record<string, unknown>;
  if (message.type !== 'CR_NOTE_RESULT' || typeof message.clientNoteId !== 'string') {
    return null;
  }
  const clientNoteId = message.clientNoteId;
  if (message.status === 'transcribing') {
    return { clientNoteId, status: 'transcribing' };
  }
  if (message.status === 'saved') {
    return {
      clientNoteId,
      status: 'saved',
      note: typeof message.note === 'string' ? message.note : '',
    };
  }
  if (message.status === 'failed') {
    const reason = NOTE_FAILURES.includes(message.reason as NoteFailure)
      ? (message.reason as NoteFailure)
      : 'failed';
    return { clientNoteId, status: 'failed', reason };
  }
  return null;
};
