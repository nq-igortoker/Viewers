import { isCreateReportConfigured } from './isCreateReportConfigured';

type TestWindow = Window & { config?: { createReport?: { baseUrl?: string } } };

const testWindow = window as TestWindow;

describe('isCreateReportConfigured', () => {
  afterEach(() => {
    delete testWindow.config;
  });

  it('is false when the app config has no createReport block', () => {
    testWindow.config = {};

    expect(isCreateReportConfigured()).toBe(false);
  });

  it('is false when the block is there but names no base URL', () => {
    testWindow.config = { createReport: {} };

    expect(isCreateReportConfigured()).toBe(false);
  });

  it('is false when there is no app config at all', () => {
    expect(isCreateReportConfigured()).toBe(false);
  });

  it('is true once a base URL is configured', () => {
    testWindow.config = { createReport: { baseUrl: 'https://app.create-report.com' } };

    expect(isCreateReportConfigured()).toBe(true);
  });
});
