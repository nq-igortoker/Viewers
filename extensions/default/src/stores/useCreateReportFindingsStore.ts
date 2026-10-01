import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { FindingKind, FindingRef } from '../utils/buildCreateReportMessage';

/**
 * Session-scoped findings for the CreateReport handoff (CreateReport#26).
 *
 * The radiologist declares which finding a key image belongs to at capture
 * time, because it cannot be inferred: the same lesion looks completely
 * different in T1 and T2. This store holds that declaration for the length of
 * one viewer session; CreateReport owns the durable version and is where
 * regrouping happens. Nothing here is ever sent back from CreateReport.
 *
 * `lesion` survives as the `kind` value and in `createLesion`: it is the
 * historical name for a finding, kept because it is on the wire
 * (CreateReport#144).
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
 *
 * The word is "Finding", not "Lesion" (CreateReport#144). A group can hold a
 * normal variant, a diffuse change or a region that was checked and found
 * unremarkable, so "Lesion 2" would assert a pathology the radiologist has
 * not. CreateReport shows the same word on the board, in both of its UI
 * languages, so the two monitors agree.
 */
export const findingLabel = (finding: Finding): string => {
  if (finding.label) {
    return finding.label;
  }
  return finding.kind === 'overview' ? 'Overview' : `Finding ${finding.index}`;
};

/** One study's findings and which of them is selected. */
export interface StudySession {
  findings: Finding[];
  activeFindingId: string | null;
}

export interface CreateReportFindingsState {
  /**
   * Every study this session has seen, keyed by StudyInstanceUID.
   *
   * Reading a follow-up puts a current and a prior study on screen together,
   * and clicking between their viewports tells the store about each in turn.
   * Holding one list meant the second click discarded the first study's
   * findings; they are kept side by side now (CreateReport#129).
   */
  byStudy: Record<string, StudySession>;
  /**
   * The active study's findings, mirrored out of `byStudy` so components can
   * keep subscribing to a plain array. Written only by `commit`.
   */
  findings: Finding[];
  activeFindingId: string | null;
  /** Which study is on screen, and therefore which session the mirrors show. */
  studyInstanceUid: string | null;

  /** Adds a numbered finding with the next running number and makes it active. */
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
   * A study seen for the first time starts with an Overview active — the first
   * capture is usually a scout or whole-study view, not a single finding. A study seen
   * before is *restored*, with its findings and its selection intact, because
   * the radiologist may simply have clicked into the other viewport of a
   * comparison and expects to come back to their work (CreateReport#129).
   *
   * Being told the study for the first time only adopts it: whatever was
   * already picked from the chip survives.
   */
  startStudy: (studyInstanceUid: string) => void;
  /** Drops every finding, of every study. */
  resetSession: () => void;
}

/**
 * Finding ids must be unique across viewer *sessions*, not just within one.
 *
 * CreateReport maps `finding.id` onto its own findings per case
 * (`resolveViewerFinding`), and has no way to tell one viewer session from the
 * next. A running counter restarted at `f-1` on every page load, so after a
 * reload the first new finding reused an id the case already knew and its
 * capture was filed under the *previous* session's finding — silently, with
 * the chip and the toast both naming the one the radiologist had just asked
 * for.
 *
 * `crypto.randomUUID` needs a secure context and is absent under jsdom, so the
 * two weaker sources are there to be used, not as decoration.
 */
const randomId = (): string => {
  const webCrypto = globalThis.crypto;

  if (typeof webCrypto?.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }

  if (typeof webCrypto?.getRandomValues === 'function') {
    const bytes = webCrypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
};

const nextId = (): string => `f-${randomId()}`;

const OVERVIEW_INDEX = 0;

/**
 * Where findings live before anything has said which study is on screen.
 *
 * The chip can be used that early, and the session is moved under the real uid
 * the moment one arrives, so nothing the radiologist picked is lost.
 */
const PENDING_STUDY = '';

const EMPTY_SESSION: StudySession = { findings: [], activeFindingId: null };

/** The key whose session the mirrored `findings` / `activeFindingId` show. */
const activeKey = (state: CreateReportFindingsState): string =>
  state.studyInstanceUid ?? PENDING_STUDY;

const sessionOf = (state: CreateReportFindingsState, key: string): StudySession =>
  state.byStudy[key] ?? EMPTY_SESSION;

/**
 * Writes a session back and re-derives the mirrors.
 *
 * Every mutation goes through here, so `findings` and `activeFindingId` cannot
 * drift from the session they are supposed to reflect.
 */
const commit = (
  state: CreateReportFindingsState,
  key: string,
  session: StudySession
): Partial<CreateReportFindingsState> => {
  const byStudy = { ...state.byStudy, [key]: session };
  const visible = key === activeKey(state) ? session : sessionOf(state, activeKey(state));
  return { byStudy, findings: visible.findings, activeFindingId: visible.activeFindingId };
};

export const useCreateReportFindingsStore = create<CreateReportFindingsState>()(
  devtools(
    (set, get) => ({
      byStudy: {},
      findings: [],
      activeFindingId: null,
      studyInstanceUid: null,

      createLesion: (label?: string) => {
        const state = get();
        const key = activeKey(state);
        const session = sessionOf(state, key);
        // Numbered within its own study: the prior's findings are not the
        // current study's, so each starts at 1.
        const lesionCount = session.findings.filter(f => f.kind === 'lesion').length;
        const finding: Finding = {
          id: nextId(),
          index: lesionCount + 1,
          kind: 'lesion' as FindingKind,
          imageCount: 0,
          imageKeys: [],
          ...(label === undefined ? {} : { label }),
        };

        set(
          current =>
            commit(current, key, {
              findings: [...sessionOf(current, key).findings, finding],
              activeFindingId: finding.id,
            }),
          false,
          'createReportFindings/createLesion'
        );

        return finding;
      },

      ensureOverview: () => {
        const state = get();
        const key = activeKey(state);
        const existing = sessionOf(state, key).findings.find(f => f.kind === 'overview');
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
          current =>
            commit(current, key, {
              ...sessionOf(current, key),
              findings: [...sessionOf(current, key).findings, finding],
            }),
          false,
          'createReportFindings/ensureOverview'
        );

        return finding;
      },

      setActiveFinding: (id: string) => {
        const state = get();
        const key = activeKey(state);
        if (!sessionOf(state, key).findings.some(f => f.id === id)) {
          return;
        }
        set(
          current => commit(current, key, { ...sessionOf(current, key), activeFindingId: id }),
          false,
          'createReportFindings/setActiveFinding'
        );
      },

      registerImage: (id: string, imageKey?: string) => {
        const key = activeKey(get());
        set(
          current =>
            commit(current, key, {
              ...sessionOf(current, key),
              findings: sessionOf(current, key).findings.map(f =>
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
        const state = get();
        const finding = sessionOf(state, activeKey(state)).findings.find(f => f.id === id);
        return !!finding && finding.imageKeys.includes(imageKey);
      },

      startStudy: (studyInstanceUid: string) => {
        const current = get().studyInstanceUid;
        if (current === studyInstanceUid) {
          return;
        }

        // Holding no study yet is not the same as holding a different one. The
        // chip can be used before anything tells the store which study is on
        // screen, and discarding the finding the radiologist just picked — then
        // filing their capture under Overview — is the wrong way to learn it.
        // The pending session simply moves under the uid it turned out to be.
        if (current === null) {
          set(
            state => {
              const pending = sessionOf(state, PENDING_STUDY);
              const { [PENDING_STUDY]: _moved, ...rest } = state.byStudy;
              return {
                byStudy: { ...rest, [studyInstanceUid]: pending },
                studyInstanceUid,
                findings: pending.findings,
                activeFindingId: pending.activeFindingId,
              };
            },
            false,
            'createReportFindings/adoptStudy'
          );
          const overview = get().ensureOverview();
          if (get().activeFindingId === null) {
            get().setActiveFinding(overview.id);
          }
          return;
        }

        // Another study became active. Its findings are restored if it has
        // been seen; otherwise it starts with an Overview. Either way the
        // study being left keeps everything — clicking into the prior of a
        // comparison must not cost the radiologist the current study's work.
        const seen = get().byStudy[studyInstanceUid];
        set(
          state => ({
            studyInstanceUid,
            findings: (seen ?? EMPTY_SESSION).findings,
            activeFindingId: (seen ?? EMPTY_SESSION).activeFindingId,
            byStudy: seen ? state.byStudy : { ...state.byStudy, [studyInstanceUid]: EMPTY_SESSION },
          }),
          false,
          seen ? 'createReportFindings/resumeStudy' : 'createReportFindings/startStudy'
        );

        if (!seen) {
          get().setActiveFinding(get().ensureOverview().id);
        }
      },

      resetSession: () => {
        set(
          { byStudy: {}, findings: [], activeFindingId: null, studyInstanceUid: null },
          false,
          'createReportFindings/resetSession'
        );
      },
    }),
    { name: 'CreateReportFindingsStore', enabled: DEBUG_STORE }
  )
);
