import { useCreateReportFindingsStore, findingLabel } from './useCreateReportFindingsStore';

const store = () => useCreateReportFindingsStore.getState();

beforeEach(() => {
  store().resetSession();
});

describe('useCreateReportFindingsStore', () => {
  it('starts empty, with nothing active', () => {
    expect(store().findings).toEqual([]);
    expect(store().activeFindingId).toBeNull();
  });

  it('numbers the first lesion 1 and makes it active', () => {
    const finding = store().createLesion();

    expect(finding.index).toBe(1);
    expect(finding.kind).toBe('lesion');
    expect(store().activeFindingId).toBe(finding.id);
  });

  it('gives each new lesion the next running number', () => {
    store().createLesion();
    const second = store().createLesion();

    expect(second.index).toBe(2);
  });

  it('gives lesions distinct ids', () => {
    const first = store().createLesion();
    const second = store().createLesion();

    expect(second.id).not.toBe(first.id);
  });

  it('keeps a single overview finding however often it is requested', () => {
    const first = store().ensureOverview();
    const second = store().ensureOverview();

    expect(second.id).toBe(first.id);
    expect(store().findings.filter(f => f.kind === 'overview')).toHaveLength(1);
  });

  it('does not let the overview consume a lesion number', () => {
    store().ensureOverview();
    const lesion = store().createLesion();

    expect(lesion.index).toBe(1);
  });

  it('switches the active finding', () => {
    const first = store().createLesion();
    store().createLesion();

    store().setActiveFinding(first.id);

    expect(store().activeFindingId).toBe(first.id);
  });

  it('ignores a request to activate a finding that does not exist', () => {
    const finding = store().createLesion();

    store().setActiveFinding('nope');

    expect(store().activeFindingId).toBe(finding.id);
  });

  it('counts the images registered against a finding', () => {
    const finding = store().createLesion();

    store().registerImage(finding.id, 'sop-1');
    store().registerImage(finding.id, 'sop-2');

    expect(store().findings.find(f => f.id === finding.id).imageCount).toBe(2);
  });

  it('counts images per finding, not in total', () => {
    const first = store().createLesion();
    const second = store().createLesion();

    store().registerImage(first.id, 'sop-1');
    store().registerImage(second.id, 'sop-2');
    store().registerImage(second.id, 'sop-3');

    expect(store().findings.find(f => f.id === first.id).imageCount).toBe(1);
    expect(store().findings.find(f => f.id === second.id).imageCount).toBe(2);
  });
});

describe('ids across viewer sessions', () => {
  // CreateReport maps `finding.id` onto its own findings per case
  // (`resolveViewerFinding`). An id handed out twice by two different viewer
  // sessions therefore files the second capture under the *first* session's
  // lesion, and neither side shows that anything went wrong.
  // A fresh module registry is the closest jest gets to a reloaded viewer: the
  // store's module-level state starts over, exactly as it does on F5.
  const freshSession = (): typeof useCreateReportFindingsStore => {
    let store: typeof useCreateReportFindingsStore;
    jest.isolateModules(() => {
      store = jest.requireActual('./useCreateReportFindingsStore').useCreateReportFindingsStore;
    });
    return store;
  };

  it('does not reuse an id after the viewer is reloaded', () => {
    const before = freshSession().getState().createLesion().id;
    const after = freshSession().getState().createLesion().id;

    expect(after).not.toBe(before);
  });

  it('keeps ids distinct across many sessions and many lesions', () => {
    const ids = new Set<string>();
    for (let session = 0; session < 5; session++) {
      const state = freshSession().getState();
      for (let lesion = 0; lesion < 4; lesion++) {
        ids.add(state.createLesion().id);
      }
      ids.add(state.ensureOverview().id);
    }

    expect(ids.size).toBe(25);
  });

  it('still gives each finding in one session its own id', () => {
    expect(store().createLesion().id).not.toBe(store().createLesion().id);
  });
});

describe('adopting the study', () => {
  it('keeps a lesion the radiologist picked before the first capture', () => {
    const lesion = store().createLesion();

    // The chip is used before the study is known: until the viewport reports
    // one, or R is pressed, the store holds no uid.
    store().startStudy('1.2.840.113619.2.55.3');

    const active = store().findings.find(f => f.id === store().activeFindingId);
    expect(active?.kind).toBe('lesion');
    expect(active?.id).toBe(lesion.id);
  });

  it('keeps the images already registered against that lesion', () => {
    const lesion = store().createLesion();
    store().registerImage(lesion.id, 'sop-1');

    store().startStudy('1.2.840.113619.2.55.3');

    expect(store().findings.find(f => f.id === lesion.id)?.imageCount).toBe(1);
  });

  it('does not add a second finding when one was already picked', () => {
    const picked = store().createLesion();

    store().startStudy('1.2.840.113619.2.55.3');

    expect(store().findings.filter(f => f.kind === 'lesion')).toHaveLength(1);
    expect(store().activeFindingId).toBe(picked.id);
  });

  it('still has an overview to fall back to, once one is asked for', () => {
    store().createLesion();
    store().startStudy('1.2.840.113619.2.55.3');

    expect(store().ensureOverview().kind).toBe('overview');
  });

  it('adopts the uid, so a later capture in the same study changes nothing', () => {
    const lesion = store().createLesion();
    store().startStudy('1.2.840.113619.2.55.3');

    store().startStudy('1.2.840.113619.2.55.3');

    expect(store().activeFindingId).toBe(lesion.id);
  });
});

describe('opening a study', () => {
  // The radiologist almost always starts on a finding, so starting on
  // Overview cost one chip interaction per study at the moment they wanted
  // to capture (CreateReport#141). Overview is still a deliberate choice for
  // a scout or whole-study view.
  it('starts on Finding 1, already active', () => {
    store().startStudy('1.2.3');

    expect(store().findings).toHaveLength(1);
    expect(store().findings[0].kind).toBe('lesion');
    expect(store().findings[0].index).toBe(1);
    expect(store().activeFindingId).toBe(store().findings[0].id);
  });

  it('does not create an overview until one is asked for', () => {
    store().startStudy('1.2.3');

    expect(store().findings.some(f => f.kind === 'overview')).toBe(false);
  });

  it('numbers the next finding 2, since Finding 1 already exists', () => {
    store().startStudy('1.2.3');

    expect(store().createLesion().index).toBe(2);
  });

  it('still offers Overview when it is chosen', () => {
    store().startStudy('1.2.3');
    const overview = store().ensureOverview();

    expect(overview.kind).toBe('overview');
    expect(overview.index).toBe(0);
  });

  it('opens a study seen for the first time on its own Finding 1', () => {
    store().startStudy('1.2.3');
    store().createLesion();

    store().startStudy('9.8.7');

    expect(store().findings).toHaveLength(1);
    expect(store().findings[0].kind).toBe('lesion');
    expect(store().findings[0].index).toBe(1);
  });

  it('keeps the findings when the same study is reopened', () => {
    store().startStudy('1.2.3');
    const lesion = store().createLesion();

    store().startStudy('1.2.3');

    expect(store().findings).toHaveLength(2);
    expect(store().activeFindingId).toBe(lesion.id);
  });
});

describe('capturing the same image twice', () => {
  it('reports an image as not yet attached', () => {
    const finding = store().createLesion();

    expect(store().hasImage(finding.id, 'sop-1')).toBe(false);
  });

  it('reports an image as attached once it is registered', () => {
    const finding = store().createLesion();

    store().registerImage(finding.id, 'sop-1');

    expect(store().hasImage(finding.id, 'sop-1')).toBe(true);
  });

  it('lets the same image be attached to a different finding', () => {
    const first = store().createLesion();
    const second = store().createLesion();
    store().registerImage(first.id, 'sop-1');

    expect(store().hasImage(second.id, 'sop-1')).toBe(false);
  });

  it('still counts an image that carries no identity', () => {
    const finding = store().createLesion();

    store().registerImage(finding.id);
    store().registerImage(finding.id);

    expect(store().findings.find(f => f.id === finding.id).imageCount).toBe(2);
  });
});

describe('findingLabel', () => {
  // The user-facing word is "Finding", not "Lesion" (CreateReport#144): a group
  // may hold a normal variant or a region that was checked and found
  // unremarkable, and "Lesion 2" asserts a pathology the radiologist has not.
  it('numbers an unnamed finding', () => {
    expect(findingLabel(store().createLesion())).toBe('Finding 1');
  });

  it('keeps numbering findings past the first', () => {
    store().createLesion();
    expect(findingLabel(store().createLesion())).toBe('Finding 2');
  });

  it('names the overview', () => {
    expect(findingLabel(store().ensureOverview())).toBe('Overview');
  });

  it('prefers a label the user gave over the number', () => {
    expect(findingLabel(store().createLesion('Liver segment 7'))).toBe('Liver segment 7');
  });
});

describe('two studies on screen at once', () => {
  // Reading a follow-up means a current and a prior study side by side.
  // Clicking into the prior viewport tells the store about that study, and
  // that must not cost the radiologist the lesions declared on the current one
  // (CreateReport#129).
  const CURRENT = '1.2.840.113619.2.55.current';
  const PRIOR = '1.2.840.113619.2.55.prior';

  it('keeps the first study\'s findings when another study becomes active', () => {
    store().startStudy(CURRENT);
    const lesion = store().createLesion();

    store().startStudy(PRIOR);
    store().startStudy(CURRENT);

    expect(store().findings.map(f => f.id)).toContain(lesion.id);
  });

  it('restores the active selection on the way back', () => {
    store().startStudy(CURRENT);
    const lesion = store().createLesion();

    store().startStudy(PRIOR);
    store().startStudy(CURRENT);

    expect(store().activeFindingId).toBe(lesion.id);
  });

  it('restores the images already registered against a finding', () => {
    store().startStudy(CURRENT);
    const lesion = store().createLesion();
    store().registerImage(lesion.id, 'sop-1#1');

    store().startStudy(PRIOR);
    store().startStudy(CURRENT);

    const restored = store().findings.find(f => f.id === lesion.id);
    expect(restored?.imageCount).toBe(1);
    expect(store().hasImage(lesion.id, 'sop-1#1')).toBe(true);
  });

  it("shows only the active study's findings, not both studies at once", () => {
    store().startStudy(CURRENT);
    const currentIds = [store().findings[0].id, store().createLesion().id];
    store().startStudy(PRIOR);
    store().createLesion();

    const visible = store().findings.map(f => f.id);
    expect(visible).toHaveLength(2);
    expect(visible.some(id => currentIds.includes(id))).toBe(false);
  });

  it("numbers each study's findings from one", () => {
    store().startStudy(CURRENT);
    store().createLesion();
    store().createLesion();

    store().startStudy(PRIOR);

    // The prior opens on its own Finding 1 rather than continuing the
    // current study's count, and the next one it is given is 2.
    expect(store().findings.map(f => f.index)).toEqual([1]);
    expect(store().createLesion().index).toBe(2);
  });

  it('gives the prior study its own overview rather than the current one\'s', () => {
    store().startStudy(CURRENT);
    const currentOverview = store().ensureOverview();

    store().startStudy(PRIOR);

    expect(store().ensureOverview().id).not.toBe(currentOverview.id);
  });

  it('files a capture under the finding active for the study being captured', () => {
    store().startStudy(CURRENT);
    const currentLesion = store().createLesion();
    store().startStudy(PRIOR);
    const priorLesion = store().createLesion();

    // Back on the current study, as a capture there would do.
    store().startStudy(CURRENT);

    expect(store().activeFindingId).toBe(currentLesion.id);
    expect(store().activeFindingId).not.toBe(priorLesion.id);
  });

  it('clears every study on resetSession, not just the active one', () => {
    store().startStudy(CURRENT);
    store().createLesion();
    store().startStudy(PRIOR);
    store().createLesion();

    const before = store().byStudy[CURRENT].findings.map(f => f.id);
    store().resetSession();
    expect(store().byStudy).toEqual({});

    // Reopening gives a brand-new Finding 1, not the one from before.
    store().startStudy(CURRENT);
    const after = store().findings;
    expect(after).toHaveLength(1);
    expect(before).not.toContain(after[0].id);
  });
});

describe('numbering continues from the app (CreateReport#140)', () => {
  // CreateReport tells the viewer the next free finding number for the case
  // behind a study (CR_HELLO), so a reload — or a study whose case already
  // has findings from the board or an earlier session — does not hand out a
  // number the case already uses.
  it('starts the first finding at the number the app provided', () => {
    store().setBaseFindingNumber('1.2.3', 4);

    store().startStudy('1.2.3');

    expect(store().findings[0].index).toBe(4);
  });

  it('keeps counting up from that base for later findings', () => {
    store().setBaseFindingNumber('1.2.3', 4);
    store().startStudy('1.2.3');

    expect(store().createLesion().index).toBe(5);
  });

  it('defaults to Finding 1 when the app never sends a base number', () => {
    store().startStudy('1.2.3');

    expect(store().findings[0].index).toBe(1);
  });

  it('applies a base number that arrives before the study is known', () => {
    // The postMessage handshake can resolve before OHIF reports its study.
    store().setBaseFindingNumber('1.2.3', 7);

    store().startStudy('1.2.3');

    expect(store().findings[0].index).toBe(7);
  });

  it('keeps a lesion picked before the study was known, then numbers the next one from the base', () => {
    const picked = store().createLesion();
    store().setBaseFindingNumber('1.2.3', 7);

    store().startStudy('1.2.3');

    // The pre-existing pick is unaffected...
    expect(store().activeFindingId).toBe(picked.id);
    expect(store().findings.find(f => f.id === picked.id)?.index).toBe(1);
    // ...but a genuinely new one respects the base the app sent.
    expect(store().createLesion().index).toBe(8);
  });

  it('only applies the base number to the study it was sent for', () => {
    store().setBaseFindingNumber('1.2.3', 9);

    store().startStudy('9.8.7');

    expect(store().findings[0].index).toBe(1);
  });

  it('updates the base for a study already open, without renumbering existing findings', () => {
    store().startStudy('1.2.3');
    const autoFirst = store().findings[0];

    store().setBaseFindingNumber('1.2.3', 5);

    expect(store().findings.find(f => f.id === autoFirst.id)?.index).toBe(1);
    expect(store().createLesion().index).toBe(6);
  });

  it('applies a late base number to a study that is not the active one', () => {
    store().startStudy('1.2.3');
    store().startStudy('9.8.7');

    store().setBaseFindingNumber('1.2.3', 6);
    store().startStudy('1.2.3');

    expect(store().createLesion().index).toBe(7);
  });
});
