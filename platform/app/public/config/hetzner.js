/** @type {AppTypes.Config} */
window.config = {
  routerBasename: null,
  // Demo data only — Igor's explicit decision (CreateReport#95, 2026-07-16): hide the
  // investigational-use dialog for demos; MUST be replaced by an MDR-appropriate notice
  // before any real patient data (pilot study, CreateReport#89).
  investigationalUseDialog: { option: 'never' },
  // CreateReport branding (CreateReport#95): logo links back to the worklist.
  whiteLabeling: {
    createLogoComponentFn: function (React) {
      return React.createElement(
        'a',
        {
          target: '_self',
          rel: 'noopener noreferrer',
          className: 'flex items-center',
          href: 'https://app.create-report.com',
        },
        React.createElement('img', {
          src: (window.PUBLIC_URL || '/') + 'assets/createreport-logo.svg',
          className: 'h-8',
          alt: 'CreateReport',
        })
      );
    },
  },
  customizationService: ['@ohif/extension-default.customizationModule.helloPage'],
  extensions: [],
  modes: [],
  showStudyList: true,
  maxNumberOfWebWorkers: 4,
  // below flag is for performance reasons, but it might not work for all servers
  showWarningMessageForCrossOrigin: true,
  showCPUFallbackMessage: true,
  showLoadingIndicator: true,
  strictZSpacingForVolumeViewport: true,
  // filterQueryParam: false,
  defaultDataSourceName: 'pacs',
  dataSources: [
    {
      // CreateReport#92: Orthanc PACS (public read-only DICOMweb, see CreateReport#91)
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
        supportsStow: false,
        supportsReject: false,
        dicomUploadEnabled: false,
        omitQuotationForMultipartRequest: true,
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'local',
      configuration: {
        friendlyName: 'Static WADO Local Data',
        name: 'DCM4CHEE',
        qidoRoot: 'http://localhost:3001/dicomweb',
        wadoRoot: 'http://localhost:3001/dicomweb',
        qidoSupportsIncludeField: false,
        supportsReject: true,
        supportsStow: true,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        staticWado: true,
        singlepart: 'video',
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'docker',
      configuration: {
        friendlyName: 'Static WADO Docker Data',
        name: 'DCM4CHEE',
        qidoRoot: 'http://localhost:25080/dicomweb',
        wadoRoot: 'http://localhost:25080/dicomweb',
        qidoSupportsIncludeField: false,
        supportsReject: true,
        supportsStow: true,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        staticWado: true,
        singlepart: 'bulkdata,video,pdf',
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'ohif',
      configuration: {
        friendlyName: 'AWS S3 Static wado server',
        name: 'aws',
        wadoUriRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
        qidoRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
        wadoRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
        qidoSupportsIncludeField: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        staticWado: true,
        singlepart: 'bulkdata,video,pdf',
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
      },
    },
    {
      friendlyName: 'StaticWado default data',
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomweb',
      configuration: {
        name: 'DCM4CHEE',
        wadoUriRoot: '/dicomweb',
        qidoRoot: '/dicomweb',
        wadoRoot: '/dicomweb',
        qidoSupportsIncludeField: false,
        supportsReject: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        staticWado: true,
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomjson',
      sourceName: 'dicomjson',
      configuration: {
        friendlyName: 'dicom json',
        name: 'json',
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomlocal',
      sourceName: 'dicomlocal',
      configuration: {
        friendlyName: 'dicom local',
      },
    },
  ],
  httpErrorHandler: error => {
    // This is 429 when rejected from the public idc sandbox too often.
    console.warn(error.status);

    // Could use services manager here to bring up a dialog/modal if needed.
    console.warn('test, navigate to https://ohif.org/');
  },
  // CreateReport Integration Configuration
  createReport: {
    // baseUrl can be set via CREATE_REPORT_BASE_URL environment variable
    baseUrl: (function() {
      if (typeof window !== 'undefined' && window.env && window.env.CREATE_REPORT_BASE_URL) {
        return window.env.CREATE_REPORT_BASE_URL;
      }
      // Hetzner production: viewer.create-report.com → app.create-report.com
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
        return 'https://app.create-report.com';
      }
      return 'http://localhost:3001'; // Local development (CreateReport dev server)
    })(),
    selectedLanguage: 'de', // Default language: 'de' for German reports
    // apiKey can be set via CREATE_REPORT_API_KEY environment variable
    apiKey: (function() {
      if (typeof window !== 'undefined' && window.env && window.env.CREATE_REPORT_API_KEY) {
        return window.env.CREATE_REPORT_API_KEY;
      }
      return ''; // Default: API Key for authentication (set via environment variable or config)
    })(),
  },
};
