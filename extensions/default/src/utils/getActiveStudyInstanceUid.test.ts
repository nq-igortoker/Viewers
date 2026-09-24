import { getActiveStudyInstanceUid } from './getActiveStudyInstanceUid';

const servicesManager = (grid: any, displaySets: Record<string, any> = {}): any => ({
  services: {
    viewportGridService: { getState: () => grid },
    displaySetService: {
      getDisplaySetByUID: (uid: string) => displaySets[uid],
    },
  },
});

describe('getActiveStudyInstanceUid', () => {
  it('reads the study of the active viewport', () => {
    const manager = servicesManager(
      {
        activeViewportId: 'viewport-1',
        viewports: new Map([['viewport-1', { displaySetInstanceUIDs: ['ds-1'] }]]),
      },
      { 'ds-1': { StudyInstanceUID: '1.2.3' } }
    );

    expect(getActiveStudyInstanceUid(manager)).toBe('1.2.3');
  });

  it('follows the active viewport rather than the first one', () => {
    const manager = servicesManager(
      {
        activeViewportId: 'viewport-2',
        viewports: new Map([
          ['viewport-1', { displaySetInstanceUIDs: ['ds-1'] }],
          ['viewport-2', { displaySetInstanceUIDs: ['ds-2'] }],
        ]),
      },
      { 'ds-1': { StudyInstanceUID: '1.2.3' }, 'ds-2': { StudyInstanceUID: '9.8.7' } }
    );

    expect(getActiveStudyInstanceUid(manager)).toBe('9.8.7');
  });

  it('returns null before any viewport has a display set', () => {
    const manager = servicesManager({
      activeViewportId: 'viewport-1',
      viewports: new Map([['viewport-1', {}]]),
    });

    expect(getActiveStudyInstanceUid(manager)).toBeNull();
  });

  it('returns null when the display set is unknown', () => {
    const manager = servicesManager({
      activeViewportId: 'viewport-1',
      viewports: new Map([['viewport-1', { displaySetInstanceUIDs: ['gone'] }]]),
    });

    expect(getActiveStudyInstanceUid(manager)).toBeNull();
  });

  it('returns null rather than throwing when the services are not there yet', () => {
    expect(getActiveStudyInstanceUid({ services: {} } as any)).toBeNull();
  });
});
