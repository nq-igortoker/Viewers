/**
 * Builds the `CR_ADD_IMAGE` postMessage payload for CreateReport.
 *
 * Kept separate from the transport (createReportIncrementalHandoff.ts) so the
 * wire format can be tested without a window: this function is pure.
 *
 * Versioning (CreateReport#26): v3 adds a single field, `finding`, naming the
 * lesion the image belongs to. A message without a finding stays v2-shaped, so
 * nothing changes for viewers or receivers that do not use the lesion chip.
 */

import type { DicomRef, DicomMetaExcerpt } from './getViewportDicomContext';

export type FindingKind = 'lesion' | 'overview';

/**
 * The lesion an image was captured for, as it crosses the window boundary.
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

export interface CreateReportAddImageMessage {
  type: 'CR_ADD_IMAGE';
  version: 2 | 3;
  fileName: string;
  mimeType: string;
  arrayBuffer: ArrayBuffer;
  dicomRef?: DicomRef;
  meta?: DicomMetaExcerpt;
  finding?: FindingRef;
}

export const buildCreateReportMessage = (
  payload: CreateReportImagePayload
): CreateReportAddImageMessage => {
  const message: CreateReportAddImageMessage = {
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
