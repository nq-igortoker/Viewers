import {
  useCreateReportDictationStore,
  canRetry,
  ACCEPT_TIMEOUT_MS,
  SAVED_FLASH_MS,
  type DictationTarget,
} from './useCreateReportDictationStore';
import { useCreateReportFindingsStore } from './useCreateReportFindingsStore';
import { parseNoteResult } from '../utils/buildCreateReportMessage';

// jsdom's Blob has no arrayBuffer(); browsers do. Its FileReader runs on the
// faked timers, so the bytes are stood in for — no test reads them.
if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function (this: Blob) {
    return Promise.resolve(new ArrayBuffer(this.size));
  };
}

/** A MediaRecorder that hands over one chunk when stopped. */
class FakeRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

const stream = { getTracks: () => [{ stop: jest.fn() }] } as unknown as MediaStream;
const target: DictationTarget = {
  finding: { id: 'f-1', index: 1, kind: 'lesion' },
  findingName: 'Finding 1',
  studyInstanceUid: '1.2.3',
};

let clock = 0;
let sent: { clientNoteId: string; finding: unknown; dicomRef: unknown }[] = [];
let connected = true;
let onSaved: jest.Mock;
let reconnect: jest.Mock;
let ids = 0;

const store = () => useCreateReportDictationStore.getState();
/** Lets pending promise callbacks run; setTimeout is faked here. */
const flush = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
};

/** Records for `ms`, then stops, and lets the delivery read the audio. */
const record = async (ms: number) => {
  store().toggle(target);
  await jest.runOnlyPendingTimersAsync();
  clock += ms;
  store().stop();
  await flush();
};

beforeEach(() => {
  jest.useFakeTimers();
  clock = 0;
  sent = [];
  connected = true;
  ids = 0;
  onSaved = jest.fn();
  reconnect = jest.fn(() => Promise.resolve(true));
  useCreateReportDictationStore.setState({
    status: 'idle',
    elapsedMs: 0,
    kept: null,
    reason: null,
    readBack: null,
    micError: null,
  });
  store().configure({
    getUserMedia: () => Promise.resolve(stream),
    createRecorder: () => new FakeRecorder() as unknown as MediaRecorder,
    send: message => {
      if (!connected) {
        return false;
      }
      sent.push(message);
      return true;
    },
    isConnected: () => connected,
    reconnect,
    newId: () => `note-${++ids}`,
    now: () => clock,
    onSaved,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('dictation in the viewer (CreateReport#183)', () => {
  it('sends a recording for the chip finding, then reads the saved note back', async () => {
    await record(3000);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      type: 'CR_ADD_NOTE',
      version: 1,
      clientNoteId: 'note-1',
      finding: { id: 'f-1', index: 1, kind: 'lesion' },
      dicomRef: { studyInstanceUid: '1.2.3' },
      durationMs: 3000,
    });
    expect(store().status).toBe('sending');

    store().receive({ clientNoteId: 'note-1', status: 'transcribing' });
    store().receive({ clientNoteId: 'note-1', status: 'saved', note: 'Kein Erguss.' });
    expect(store().status).toBe('saved');
    expect(store().kept).toBeNull();
    expect(store().readBack).toMatchObject({ findingName: 'Finding 1', note: 'Kein Erguss.' });
    expect(onSaved).toHaveBeenCalledWith('1.2.3', 'f-1');

    jest.advanceTimersByTime(SAVED_FLASH_MS);
    expect(store().status).toBe('idle');
    expect(store().readBack).not.toBeNull(); // read back until dismissed
  });

  it('stops showing the recording the moment it is stopped, not once the audio is read', async () => {
    store().toggle(target);
    await jest.runOnlyPendingTimersAsync();
    clock += 2000;
    store().stop();
    expect(store().status).toBe('sending');
    await flush();
    expect(sent).toHaveLength(1);
  });

  it('sends nothing for a click shorter than a dictation', async () => {
    await record(300);
    expect(sent).toHaveLength(0);
    expect(store().status).toBe('idle');
    expect(store().kept).toBeNull();
  });

  it('keeps the recording when no window answers, and Try again sends the same id', async () => {
    await record(2000);
    jest.advanceTimersByTime(ACCEPT_TIMEOUT_MS);
    expect(store().status).toBe('undelivered');
    expect(store().reason).toBe('no-answer');
    expect(store().kept?.clientNoteId).toBe('note-1');

    store().retry();
    expect(store().status).toBe('sending');
    await flush();
    expect(sent.map(m => m.clientNoteId)).toEqual(['note-1', 'note-1']);
    store().receive({ clientNoteId: 'note-1', status: 'saved', note: 'x' });
    expect(store().status).toBe('saved');
  });

  it('with the CreateReport window gone, Try again reconnects before sending', async () => {
    connected = false;
    await record(2000);
    expect(store().status).toBe('undelivered');
    expect(store().reason).toBe('no-window');
    expect(sent).toHaveLength(0);

    connected = true;
    store().retry();
    expect(reconnect).not.toHaveBeenCalled(); // connected again on its own: sent directly
    await jest.runOnlyPendingTimersAsync();
    expect(sent.map(m => m.clientNoteId)).toEqual(['note-1']);
  });

  it('Try again opens CreateReport when there is no window, then sends', async () => {
    connected = false;
    await record(2000);
    reconnect.mockImplementation(() => {
      connected = true;
      return Promise.resolve(true);
    });
    store().retry();
    expect(reconnect).toHaveBeenCalledTimes(1);
    expect(store().status).toBe('connecting');
    await flush();
    await jest.runOnlyPendingTimersAsync();
    expect(sent.map(m => m.clientNoteId)).toEqual(['note-1']);
  });

  it('waiting for CreateReport can be stopped, and a late window then changes nothing', async () => {
    connected = false;
    await record(2000);
    let opened: (value: boolean) => void = () => {};
    reconnect.mockImplementation(() => new Promise(resolve => (opened = resolve)));
    store().retry();
    expect(store().status).toBe('connecting');
    store().discard(); // not while waiting
    expect(store().kept).not.toBeNull();
    store().cancelConnect();
    expect(store().status).toBe('undelivered');
    expect(store().reason).toBe('no-window');
    connected = true;
    opened(true);
    await flush();
    expect(sent).toHaveLength(0);
    expect(store().status).toBe('undelivered');
    store().discard();
    expect(store().kept).toBeNull();
  });

  it('a late "transcribing" after giving up on an answer puts it back on its way', async () => {
    await record(2000);
    jest.advanceTimersByTime(ACCEPT_TIMEOUT_MS);
    expect(store().reason).toBe('no-answer');
    store().receive({ clientNoteId: 'note-1', status: 'transcribing' });
    expect(store().status).toBe('sending');
    store().discard(); // not while on its way
    store().receive({ clientNoteId: 'note-1', status: 'saved', note: 'Kein Erguss.' });
    expect(store().status).toBe('saved');
    expect(onSaved).toHaveBeenCalledWith('1.2.3', 'f-1');
  });

  it('a failure from CreateReport keeps the recording, and says why', async () => {
    await record(2000);
    store().receive({ clientNoteId: 'note-1', status: 'transcribing' });
    store().receive({ clientNoteId: 'note-1', status: 'failed', reason: 'not-open-case' });
    expect(store().status).toBe('undelivered');
    expect(store().reason).toBe('not-open-case');
    expect(store().kept).not.toBeNull();
    expect(canRetry('not-open-case')).toBe(true);
    expect(canRetry('rejected')).toBe(false);
  });

  it('ignores an answer for another recording', async () => {
    await record(2000);
    store().receive({ clientNoteId: 'old', status: 'saved', note: 'x' });
    expect(store().status).toBe('sending');
  });

  it('does not start a new recording while one is kept, until it is discarded', async () => {
    connected = false;
    await record(2000);
    store().toggle(target);
    await jest.runOnlyPendingTimersAsync();
    expect(store().status).toBe('undelivered');

    store().discard();
    expect(store().kept).toBeNull();
    expect(store().status).toBe('idle');
  });

  it('a second press while the microphone is being asked for calls the recording off', async () => {
    let grant: (value: MediaStream) => void = () => {};
    store().configure({ getUserMedia: () => new Promise(resolve => (grant = resolve)) });
    store().toggle(target);
    expect(store().status).toBe('starting');
    store().toggle(target);
    grant(stream);
    await jest.runOnlyPendingTimersAsync();
    expect(store().status).toBe('idle');
  });

  it('says nothing about a microphone refused after the recording was called off', async () => {
    let refuse: (error: unknown) => void = () => {};
    store().configure({ getUserMedia: () => new Promise((_, reject) => (refuse = reject)) });
    store().toggle(target);
    store().toggle(target);
    refuse(new DOMException('no', 'NotAllowedError'));
    await flush();
    expect(store().micError).toBeNull();
    expect(store().status).toBe('idle');
  });

  it('says the microphone was refused', async () => {
    store().configure({
      getUserMedia: () => Promise.reject(new DOMException('no', 'NotAllowedError')),
    });
    store().toggle(target);
    await jest.runOnlyPendingTimersAsync();
    expect(store().micError).toBe('denied');
    expect(store().status).toBe('idle');
  });
});

describe('CR_NOTE_RESULT parsing', () => {
  it('reads the three statuses and maps an unknown reason to failed', () => {
    expect(
      parseNoteResult({ type: 'CR_NOTE_RESULT', clientNoteId: 'a', status: 'transcribing' })
    ).toEqual({
      clientNoteId: 'a',
      status: 'transcribing',
    });
    expect(
      parseNoteResult({ type: 'CR_NOTE_RESULT', clientNoteId: 'a', status: 'saved', note: 'n' })
    ).toEqual({ clientNoteId: 'a', status: 'saved', note: 'n' });
    expect(
      parseNoteResult({
        type: 'CR_NOTE_RESULT',
        clientNoteId: 'a',
        status: 'failed',
        reason: 'weird',
      })
    ).toEqual({ clientNoteId: 'a', status: 'failed', reason: 'failed' });
    expect(parseNoteResult({ type: 'CR_HELLO' })).toBeNull();
    expect(parseNoteResult({ type: 'CR_NOTE_RESULT', status: 'saved' })).toBeNull();
  });
});

describe('a finding with a note keeps its number (CreateReport#183)', () => {
  it('is not renumbered when CreateReport sends its base afterwards', () => {
    const findings = useCreateReportFindingsStore.getState();
    findings.resetSession();
    findings.startStudy('9.9.9');
    const first = useCreateReportFindingsStore.getState().ensureFirstFinding();
    useCreateReportFindingsStore.getState().registerNote('9.9.9', first.id);
    useCreateReportFindingsStore.getState().setBaseFindingNumber('9.9.9', 4);
    const after = useCreateReportFindingsStore.getState().findings.find(f => f.id === first.id);
    expect(after?.index).toBe(first.index);
  });
});
