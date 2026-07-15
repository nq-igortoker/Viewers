/** @type {AppTypes.Config} */
// CreateReport#91: Orthanc PACS on pacs.create-report.com (public read-only DICOMweb).
// Run locally with:  APP_CONFIG=config/pacs.js yarn dev
window.config = {
  routerBasename: null,
  showStudyList: true,
  extensions: [],
  modes: [],
  showWarningMessageForCrossOrigin: true,
  showCPUFallbackMessage: true,
  showLoadingIndicator: true,
  strictZSpacingForVolumeViewport: true,
  studyPrefetcher: {
    enabled: true,
    displaySetsCount: 2,
    maxNumPrefetchRequests: 10,
    order: 'closest',
  },
  defaultDataSourceName: 'pacs',
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'pacs',
      configuration: {
        friendlyName: 'CreateReport PACS (Orthanc)',
        name: 'Orthanc',
        qidoRoot: 'https://pacs.create-report.com/dicom-web',
        wadoRoot: 'https://pacs.create-report.com/dicom-web',
        qidoSupportsIncludeField: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        // The public endpoint is read-only (GET/OPTIONS only) — no STOW/reject/upload.
        supportsStow: false,
        supportsReject: false,
        dicomUploadEnabled: false,
        omitQuotationForMultipartRequest: true,
      },
    },
  ],
  httpErrorHandler: error => {
    console.warn(`HTTP Error Handler (status: ${error.status})`, error);
  },
};
