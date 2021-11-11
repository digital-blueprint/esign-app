export default {
    local: {
        basePath: '/dist/',
        entryPointURL: 'http://127.0.0.1:8000',
        keyCloakBaseURL: 'https://auth-dev.tugraz.at/auth',
        keyCloakRealm: 'tugraz-vpu',
        keyCloakClientId: 'auth-dev-mw-frontend-local',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        nextcloudBaseURL: 'http://localhost:8081',
        nextcloudName: 'TU Graz cloud',
        pdfAsQualifiedlySigningServer: 'https://sig-dev.tugraz.at',
        hiddenActivities: ['dbp-signature-verification-full'],
        enableAnnotations: true
    },
    bs: {
        basePath: '/dist/',
        entryPointURL: 'http://bs-local.com:8000',
        keyCloakBaseURL: 'https://auth-test.tugraz.at/auth',
        keyCloakRealm: 'tugraz-vpu',
        keyCloakClientId: 'auth-dev-mw-frontend-local',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        nextcloudBaseURL: 'http://bs-local.com:8081',
        nextcloudName: 'TU Graz cloud',
        pdfAsQualifiedlySigningServer: 'https://sig-dev.tugraz.at',
        hiddenActivities: [],
        enableAnnotations: true
    },
    development: {
        basePath: '/apps/signature/',
        entryPointURL: 'https://api-dev.tugraz.at',
        keyCloakBaseURL: 'https://auth-dev.tugraz.at/auth',
        keyCloakRealm: 'tugraz-vpu',
        keyCloakClientId: 'dbp-esign',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        nextcloudBaseURL: 'https://cloud-dev.tugraz.at',
        nextcloudName: 'TU Graz cloud',
        pdfAsQualifiedlySigningServer: 'https://sig-dev.tugraz.at',
        hiddenActivities: ['dbp-signature-verification-full'],
        enableAnnotations: true
    },
    demo: {
        basePath: '/apps/signature/',
        entryPointURL: 'https://api-demo.tugraz.at',
        keyCloakBaseURL: 'https://auth-demo.tugraz.at/auth',
        keyCloakRealm: 'tugraz-vpu',
        keyCloakClientId: 'dbp-esign',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 131,
        nextcloudBaseURL: 'https://cloud.tugraz.at',
        nextcloudName: 'TU Graz cloud',
        pdfAsQualifiedlySigningServer: 'https://sig-demo.tugraz.at',
        hiddenActivities: ['dbp-signature-verification-full'],
        enableAnnotations: true
    },
    production: {
        basePath: '/',
        entryPointURL: 'https://api.tugraz.at',
        keyCloakBaseURL: 'https://auth.tugraz.at/auth',
        keyCloakRealm: 'tugraz',
        keyCloakClientId: 'esig_tugraz_at',
        matomoUrl: 'https://analytics.tugraz.at/',
        matomoSiteId: 137,
        nextcloudBaseURL: 'https://cloud.tugraz.at',
        nextcloudName: 'TU Graz cloud',
        pdfAsQualifiedlySigningServer: 'https://sig.tugraz.at',
        hiddenActivities: ['dbp-signature-verification-full'],
        enableAnnotations: false
    },
};