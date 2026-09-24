import { isCreateReportConfigured } from './isCreateReportConfigured';

describe('isCreateReportConfigured', () => {
  afterEach(() => {
    delete (window as any).config;
  });

  it('is false when the app config has no createReport block', () => {
    (window as any).config = {};

    expect(isCreateReportConfigured()).toBe(false);
  });

  it('is false when the block is there but names no base URL', () => {
    (window as any).config = { createReport: {} };

    expect(isCreateReportConfigured()).toBe(false);
  });

  it('is false when there is no app config at all', () => {
    expect(isCreateReportConfigured()).toBe(false);
  });

  it('is true once a base URL is configured', () => {
    (window as any).config = { createReport: { baseUrl: 'https://app.create-report.com' } };

    expect(isCreateReportConfigured()).toBe(true);
  });
});
