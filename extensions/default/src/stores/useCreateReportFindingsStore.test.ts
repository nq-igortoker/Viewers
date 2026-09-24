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

  it('still gives the study an overview to fall back to', () => {
    store().createLesion();

    store().startStudy('1.2.840.113619.2.55.3');

    expect(store().findings.filter(f => f.kind === 'overview')).toHaveLength(1);
  });

  it('adopts the uid, so a later capture in the same study changes nothing', () => {
    const lesion = store().createLesion();
    store().startStudy('1.2.840.113619.2.55.3');

    store().startStudy('1.2.840.113619.2.55.3');

    expect(store().activeFindingId).toBe(lesion.id);
  });
});

describe('opening a study', () => {
  it('starts with an overview, already active', () => {
    store().startStudy('1.2.3');

    expect(store().findings).toHaveLength(1);
    expect(store().findings[0].kind).toBe('overview');
    expect(store().activeFindingId).toBe(store().findings[0].id);
  });

  it('still numbers the first lesion 1', () => {
    store().startStudy('1.2.3');

    expect(store().createLesion().index).toBe(1);
  });

  it('replaces the findings with a fresh overview when the study changes', () => {
    store().startStudy('1.2.3');
    store().createLesion();

    store().startStudy('9.8.7');

    expect(store().findings).toHaveLength(1);
    expect(store().findings[0].kind).toBe('overview');
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
  it('numbers an unnamed lesion', () => {
    expect(findingLabel(store().createLesion())).toBe('Lesion 1');
  });

  it('names the overview', () => {
    expect(findingLabel(store().ensureOverview())).toBe('Overview');
  });

  it('prefers a label the user gave over the number', () => {
    expect(findingLabel(store().createLesion('Liver segment 7'))).toBe('Liver segment 7');
  });
});
