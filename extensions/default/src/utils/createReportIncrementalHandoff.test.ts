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

describe('initAppHandshake — notes (CreateReport#182/#183)', () => {
  function freshNotes() {
    let handoff: HandoffModule;
    jest.isolateModules(() => {
      handoff = jest.requireActual('./createReportIncrementalHandoff');
    });
    return handoff!;
  }
  /** A CR_HELLO from a window that stays open, as the app's would. */
  function hello(
    data: Record<string, unknown>,
    source: { postMessage: jest.Mock; closed: boolean }
  ) {
    const event = new MessageEvent('message', {
      data: { type: 'CR_HELLO', ...data },
      origin: ALLOWED_ORIGIN,
    });
    Object.defineProperty(event, 'source', { value: source });
    window.dispatchEvent(event);
  }

  it('a window that says notes: true can take a dictation', () => {
    const h = freshNotes();
    h.initAppHandshake([ALLOWED_ORIGIN]);
    expect(h.canDictate()).toBe(false);
    expect(h.appRefusesNotes()).toBe(false); // nobody answered yet: greyed, not hidden
    hello({ notes: true }, { postMessage: jest.fn(), closed: false });
    expect(h.hasNotesConnection()).toBe(true);
    expect(h.canDictate()).toBe(true);
    expect(h.appRefusesNotes()).toBe(false);
  });

  it('a window that does not say so (an older app) leaves the mic hidden', () => {
    const h = freshNotes();
    h.initAppHandshake([ALLOWED_ORIGIN]);
    hello({}, { postMessage: jest.fn(), closed: false });
    expect(h.hasAppConnection()).toBe(true);
    expect(h.hasNotesConnection()).toBe(false);
    expect(h.appRefusesNotes()).toBe(true);
    expect(h.canDictate()).toBe(false);
  });

  it('once a window took notes, a recording may still be made after it went away', () => {
    const h = freshNotes();
    h.initAppHandshake([ALLOWED_ORIGIN]);
    const app = { postMessage: jest.fn(), closed: false };
    hello({ notes: true }, app);
    app.closed = true;
    expect(h.hasNotesConnection()).toBe(false);
    expect(h.canDictate()).toBe(true);
  });

  it('a window that took notes and then says it does not (rolled back) greys the mic', () => {
    const h = freshNotes();
    h.initAppHandshake([ALLOWED_ORIGIN]);
    const app = { postMessage: jest.fn(), closed: false };
    hello({ notes: true }, app);
    hello({}, app);
    expect(h.canDictate()).toBe(false);
    expect(h.appRefusesNotes()).toBe(false); // took notes once: greyed, not hidden
  });

  it('reconnecting to a window that is still there waits for a fresh CR_HELLO', async () => {
    jest.useFakeTimers();
    const h = freshNotes();
    h.initAppHandshake([ALLOWED_ORIGIN]);
    const app = { postMessage: jest.fn(), closed: false };
    hello({ notes: true }, app);
    let done: boolean | null = null;
    void h.reconnectToApp('https://unused.example').then(value => (done = value));
    expect(app.postMessage).toHaveBeenCalledWith({ type: 'CR_VIEWER_READY' }, '*');
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    expect(done).toBeNull(); // connected, but no fresh answer yet
    hello({ notes: true }, app);
    jest.advanceTimersByTime(700);
    await Promise.resolve();
    expect(done).toBe(true);
    jest.useRealTimers();
  });

  it('a fresh CR_HELLO without notes ends the reconnect at once', async () => {
    jest.useFakeTimers();
    const h = freshNotes();
    h.initAppHandshake([ALLOWED_ORIGIN]);
    const app = { postMessage: jest.fn(), closed: false };
    hello({ notes: true }, app);
    let done: boolean | null = null;
    void h.reconnectToApp('https://unused.example').then(value => (done = value));
    hello({}, app);
    jest.advanceTimersByTime(700);
    await Promise.resolve();
    expect(done).toBe(false);
    jest.useRealTimers();
  });
});
