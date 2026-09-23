import { buildCreateReportMessage } from './buildCreateReportMessage';

const basePayload = () => ({
  arrayBuffer: new ArrayBuffer(8),
  fileName: 'viewport_1.png',
  mimeType: 'image/png',
});

describe('buildCreateReportMessage', () => {
  it('sends version 2 and no finding field when no finding is active', () => {
    const message = buildCreateReportMessage(basePayload());

    expect(message.version).toBe(2);
    expect(message).not.toHaveProperty('finding');
  });

  it('sends version 3 carrying the finding when one is active', () => {
    const message = buildCreateReportMessage({
      ...basePayload(),
      finding: { id: 'a3f9', index: 2, kind: 'lesion', label: 'Lesion 2' },
    });

    expect(message.version).toBe(3);
    expect(message.finding).toEqual({
      id: 'a3f9',
      index: 2,
      kind: 'lesion',
      label: 'Lesion 2',
    });
  });

  it('omits an absent label rather than sending undefined', () => {
    const message = buildCreateReportMessage({
      ...basePayload(),
      finding: { id: 'a3f9', index: 1, kind: 'overview' },
    });

    expect(message.finding).not.toHaveProperty('label');
  });

  it('passes the image, dicomRef and meta through untouched', () => {
    const arrayBuffer = new ArrayBuffer(16);
    const dicomRef = { studyInstanceUid: '1.2.3', seriesInstanceUid: '1.2.3.4' };
    const meta = { modality: 'CT' };

    const message = buildCreateReportMessage({
      arrayBuffer,
      fileName: 'viewport_9.png',
      mimeType: 'image/jpeg',
      dicomRef,
      meta,
    });

    expect(message.type).toBe('CR_ADD_IMAGE');
    expect(message.arrayBuffer).toBe(arrayBuffer);
    expect(message.fileName).toBe('viewport_9.png');
    expect(message.mimeType).toBe('image/jpeg');
    expect(message.dicomRef).toBe(dicomRef);
    expect(message.meta).toBe(meta);
  });
});
