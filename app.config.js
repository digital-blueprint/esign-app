export default {
    local: {
        basePath: '/dist/',
        entryPointURL: 'http://127.0.0.1:8000',
        keyCloakBaseURL: 'https://auth-dev.tugraz.at/auth',
        keyCloakClientId: 'auth-dev-mw-frontend-local',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        nextcloudBaseURL: 'http://localhost:8081',
        nextcloudName: 'TU Graz cloud',
        pdfAsQualifiedlySigningServer: 'https://sig-dev.tugraz.at',
        hiddenActivities: ['dbp-signature-verification-full']
    },
    bs: {
        basePath: '/dist/',
        entryPointURL: 'http://bs-local.com:8000',
        keyCloakBaseURL: 'https://auth-test.tugraz.at/auth',
        keyCloakClientId: 'auth-dev-mw-frontend-local',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        nextcloudBaseURL: 'http://bs-local.com:8081',
        nextcloudName: 'TU Graz cloud',
        pdfAsQualifiedlySigningServer: 'https://sig-dev.tugraz.at',
        hiddenActivities: []
    },
    development: {
        basePath: '/apps/signature/',
        entryPointURL: 'https://mw-dev.tugraz.at',
        keyCloakBaseURL: 'https://auth-dev.tugraz.at/auth',
        keyCloakClientId: 'esign-dev_tugraz_at-ESIGN',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        nextcloudBaseURL: 'https://nc-dev.tugraz.at/pers',
        nextcloudName: 'TU Graz cloud',
        pdfAsQualifiedlySigningServer: 'https://sig-dev.tugraz.at',
        hiddenActivities: ['dbp-signature-verification-full']
    },
    demo: {
        basePath: '/apps/signature/',
        entryPointURL: 'https://api-demo.tugraz.at',
        keyCloakBaseURL: 'https://auth-test.tugraz.at/auth',
        keyCloakClientId: 'esig-demo_tugraz_at-ESIG',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        nextcloudBaseURL: 'https://cloud.tugraz.at',
        nextcloudName: 'TU Graz cloud',
        pdfAsQualifiedlySigningServer: 'https://sig-test.tugraz.at',
        hiddenActivities: ['dbp-signature-verification-full']
    },
    production: {
        basePath: '/',
        entryPointURL: 'https://api.tugraz.at',
        keyCloakBaseURL: 'https://auth.tugraz.at/auth',
        keyCloakClientId: 'esig_tugraz_at',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 137,
        nextcloudBaseURL: 'https://cloud.tugraz.at',
        nextcloudName: 'TU Graz cloud',
        pdfAsQualifiedlySigningServer: 'https://sig.tugraz.at',
        hiddenActivities: ['dbp-signature-verification-full']
    },
};