import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { FindingKind, FindingRef } from '../utils/buildCreateReportMessage';

/**
 * Session-scoped lesion findings for the CreateReport handoff (CreateReport#26).
 *
 * The radiologist declares which lesion a key image belongs to at capture time,
 * because it cannot be inferred: the same lesion looks completely different in
 * T1 and T2. This store holds that declaration for the length of one viewer
 * session; CreateReport owns the durable version and is where regrouping
 * happens. Nothing here is ever sent back from CreateReport.
 */

const DEBUG_STORE = false;

export interface Finding extends FindingRef {
  /** How many key images have been captured against this finding. */
  imageCount: number;
  /**
   * Which DICOM instances are already attached, so the same image cannot be
   * captured twice for the same finding by an accidental second press of R.
   * Capturing it for a *different* finding stays allowed.
   */
  imageKeys: string[];
}

/**
 * How a finding is named on screen and in notifications: the radiologist's own
 * label when they gave one, otherwise the running number.
 */
export const findingLabel = (finding: Finding): string => {
  if (finding.label) {
    return finding.label;
  }
  return finding.kind === 'overview' ? 'Overview' : `Lesion ${finding.index}`;
};

export interface CreateReportFindingsState {
  findings: Finding[];
  activeFindingId: string | null;
  /** The study the current findings belong to. */
  studyInstanceUid: string | null;

  /** Adds a lesion with the next running number and makes it active. */
  createLesion: (label?: string) => Finding;
  /** Returns the study's single overview finding, creating it on first use. */
  ensureOverview: () => Finding;
  /** Activates an existing finding. Unknown ids are ignored. */
  setActiveFinding: (id: string) => void;
  /** Records that a key image was captured against a finding. */
  registerImage: (id: string, imageKey?: string) => void;
  /** Whether this exact image is already attached to that finding. */
  hasImage: (id: string, imageKey: string) => boolean;
  /**
   * Points the store at a study.
   *
   * A *different* study starts fresh, with an Overview finding active — the
   * first capture is usually a scout or whole-study view, not a lesion. Being
   * told the study for the first time only adopts it: whatever the radiologist
   * already picked from the chip survives.
   */
  startStudy: (studyInstanceUid: string) => void;
  /** Drops every finding. */
  resetSession: () => void;
}

/**
 * Ids only have to be unique within this session — CreateReport re-keys them.
 * A counter keeps them readable in the console and reproducible in tests.
 */
let sequence = 0;
const nextId = (): string => `f-${++sequence}`;

const OVERVIEW_INDEX = 0;

export const useCreateReportFindingsStore = create<CreateReportFindingsState>()(
  devtools(
    (set, get) => ({
      findings: [],
      activeFindingId: null,
      studyInstanceUid: null,

      createLesion: (label?: string) => {
        const lesionCount = get().findings.filter(f => f.kind === 'lesion').length;
        const finding: Finding = {
          id: nextId(),
          index: lesionCount + 1,
          kind: 'lesion' as FindingKind,
          imageCount: 0,
          imageKeys: [],
          ...(label === undefined ? {} : { label }),
        };

        set(
          state => ({
            findings: [...state.findings, finding],
            activeFindingId: finding.id,
          }),
          false,
          'createReportFindings/createLesion'
        );

        return finding;
      },

      ensureOverview: () => {
        const existing = get().findings.find(f => f.kind === 'overview');
        if (existing) {
          return existing;
        }

        const finding: Finding = {
          id: nextId(),
          index: OVERVIEW_INDEX,
          kind: 'overview' as FindingKind,
          imageCount: 0,
          imageKeys: [],
        };

        set(
          state => ({ findings: [...state.findings, finding] }),
          false,
          'createReportFindings/ensureOverview'
        );

        return finding;
      },

      setActiveFinding: (id: string) => {
        if (!get().findings.some(f => f.id === id)) {
          return;
        }
        set({ activeFindingId: id }, false, 'createReportFindings/setActiveFinding');
      },

      registerImage: (id: string, imageKey?: string) => {
        set(
          state => ({
            findings: state.findings.map(f =>
              f.id === id
                ? {
                    ...f,
                    imageCount: f.imageCount + 1,
                    imageKeys: imageKey ? [...f.imageKeys, imageKey] : f.imageKeys,
                  }
                : f
            ),
          }),
          false,
          'createReportFindings/registerImage'
        );
      },

      hasImage: (id: string, imageKey: string) => {
        const finding = get().findings.find(f => f.id === id);
        return !!finding && finding.imageKeys.includes(imageKey);
      },

      startStudy: (studyInstanceUid: string) => {
        const current = get().studyInstanceUid;
        if (current === studyInstanceUid) {
          return;
        }

        // Holding no study yet is not the same as holding a different one. The
        // chip can be used before anything tells the store which study is on
        // screen, and discarding the lesion the radiologist just picked — then
        // filing their capture under Overview — is the wrong way to learn it.
        if (current === null) {
          set({ studyInstanceUid }, false, 'createReportFindings/adoptStudy');
          const overview = get().ensureOverview();
          if (get().activeFindingId === null) {
            get().setActiveFinding(overview.id);
          }
          return;
        }

        set(
          { studyInstanceUid, findings: [], activeFindingId: null },
          false,
          'createReportFindings/startStudy'
        );
        get().setActiveFinding(get().ensureOverview().id);
      },

      resetSession: () => {
        set(
          { findings: [], activeFindingId: null, studyInstanceUid: null },
          false,
          'createReportFindings/resetSession'
        );
      },
    }),
    { name: 'CreateReportFindingsStore', enabled: DEBUG_STORE }
  )
);
