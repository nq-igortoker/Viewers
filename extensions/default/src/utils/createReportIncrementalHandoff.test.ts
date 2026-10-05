/**
 * CR_HELLO finding-numbering wiring (CreateReport#140).
 *
 * `initAppHandshake` has module-level mutable state and is idempotent per
 * module instance, so each test gets a fresh module registry — the same
 * pattern `useCreateReportFindingsStore.test.ts` uses for "across sessions"
 * tests — and asserts against the store instance that same registry wired up,
 * not the one this file's top-level import would give it.
 */

const ALLOWED_ORIGIN = 'https://app.create-report.com';

type HandoffModule = typeof import('./createReportIncrementalHandoff');
type StoreModule = typeof import('../stores/useCreateReportFindingsStore');

function freshHandshake(): {
  initAppHandshake: HandoffModule['initAppHandshake'];
  store: StoreModule['useCreateReportFindingsStore'];
} {
  let handoff: HandoffModule;
  let storeModule: StoreModule;
  jest.isolateModules(() => {
    handoff = jest.requireActual('./createReportIncrementalHandoff');
    storeModule = jest.requireActual('../stores/useCreateReportFindingsStore');
  });
  return {
    initAppHandshake: handoff!.initAppHandshake,
    store: storeModule!.useCreateReportFindingsStore,
  };
}

function sendHello(data: Record<string, unknown>, origin: string = ALLOWED_ORIGIN): void {
  const event = new MessageEvent('message', { data, origin });
  Object.defineProperty(event, 'source', { value: { postMessage: jest.fn() } });
  window.dispatchEvent(event);
}

beforeEach(() => {
  Object.defineProperty(window, 'opener', {
    value: { postMessage: jest.fn() },
    configurable: true,
    writable: true,
  });
});

describe('initAppHandshake — finding numbering (CreateReport#140)', () => {
  it('sets the base finding number for the study CR_HELLO names', () => {
    const { initAppHandshake, store } = freshHandshake();
    initAppHandshake([ALLOWED_ORIGIN]);

    sendHello({ type: 'CR_HELLO', studyInstanceUid: '1.2.3', nextFindingNumber: 4 });
    store.getState().startStudy('1.2.3');

    expect(store.getState().findings[0].index).toBe(4);
  });

  it('leaves numbering untouched when CR_HELLO carries no finding-number fields', () => {
    const { initAppHandshake, store } = freshHandshake();
    initAppHandshake([ALLOWED_ORIGIN]);

    sendHello({ type: 'CR_HELLO' });
    store.getState().startStudy('9.9.9');

    expect(store.getState().findings[0].index).toBe(1);
  });

  it('ignores a zero or non-integer nextFindingNumber', () => {
    const { initAppHandshake, store } = freshHandshake();
    initAppHandshake([ALLOWED_ORIGIN]);

    sendHello({ type: 'CR_HELLO', studyInstanceUid: '5.5.5', nextFindingNumber: 0 });
    sendHello({ type: 'CR_HELLO', studyInstanceUid: '5.5.5', nextFindingNumber: 1.5 });
    store.getState().startStudy('5.5.5');

    expect(store.getState().findings[0].index).toBe(1);
  });

  it('does not apply a finding number from an origin outside the allow-list', () => {
    const { initAppHandshake, store } = freshHandshake();
    initAppHandshake([ALLOWED_ORIGIN]);

    sendHello(
      { type: 'CR_HELLO', studyInstanceUid: '6.6.6', nextFindingNumber: 9 },
      'https://evil.example'
    );
    store.getState().startStudy('6.6.6');

    expect(store.getState().findings[0].index).toBe(1);
  });
});
