import {combineURLs} from '@dbp-toolkit/common';

export class ApiError extends Error {
    /**
     * @param {number} status
     * @param {string} statusText
     * @param {object} body
     */
    constructor(status, statusText, body) {
        super(`[${status}] ${body.title ?? statusText} - ${body.detail}`);

        // Generic
        this.name = 'ApiError';
        /** @member {number} */
        this.status = status;
        /** @member {string} */
        this.statusText = statusText;

        // Problem Details
        /** @member {string} */
        this.detail = body.detail;
        /** @member {string} */
        this.title = body.title ?? null;

        // Relay-specific
        /** @member {string|null} */
        this.errorId = body['relay:errorId'] ?? null;
        /** @member {object} */
        this.errorDetails = body['relay:errorDetails'] ?? {};
    }

    /**
     * @param {Response} response
     * @returns {Promise<ApiError>}
     */
    static async fromResponse(response) {
        const body = await response.json();
        return new ApiError(response.status, response.statusText, body);
    }
}

/**
 * @typedef {object} EsignQualifiedlySignedDocument
 * @property {string} identifier
 * @property {string} contentUrl
 * @property {string} name
 * @property {number} contentSize
 */

/**
 * @typedef {object} EsignQualifiedSigningRequest
 * @property {string} identifier
 * @property {string} name
 * @property {string} url
 */

/**
 * @typedef {object} EsignAdvancedlySignedDocument
 * @property {string} identifier
 * @property {string} contentUrl
 * @property {string} name
 * @property {number} contentSize
 */

/**
 * @typedef {object} EsignSigningParameters
 * @property {number} [x]
 * @property {number} [y]
 * @property {number} [r]
 * @property {number} [w]
 * @property {number} [p]
 * @property {boolean} [invisible]
 */

/**
 * @typedef {object} EsignQualifiedBatchSigningRequest
 * @property {string} identifier
 * @property {string} url
 */

/**
 * @typedef {object} EsignQualifiedlyBatchSignedDocument
 * @property {string} identifier
 * @property {string} contentUrl
 * @property {number} contentSize
 */

/**
 * @typedef {object} EsignQualifiedBatchSigningResult
 * @property {EsignQualifiedlyBatchSignedDocument[]} documents
 */

export class EsignQualifiedBatchSigningRequestInput {
    /**
     * @param {File} file
     * @param {EsignSigningParameters} params
     * @param {object|null} userText
     */
    constructor(file, params = {}, userText = null) {
        /** @type {File} */
        this.file = file;
        /** @type {EsignSigningParameters} */
        this.params = params;
        /** @type {object|null} */
        this.userText = userText;
    }
}

export class EsignApi {
    constructor(element) {
        this._element = element;
    }

    /**
     * @param {string} code
     * @returns {Promise<EsignQualifiedlySignedDocument>}
     */
    async getQualifiedlySignedDocument(code) {
        let apiUrlBase = combineURLs(
            this._element.entryPointUrl,
            '/esign/qualifiedly-signed-documents',
        );
        const apiUrl = apiUrlBase + '/' + encodeURIComponent(code);

        const result = await fetch(apiUrl, {
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this._element.auth.token,
                'Accept-Language': this._element.lang,
            },
        });

        if (!result.ok) {
            throw await ApiError.fromResponse(result);
        }

        return await result.json();
    }

    /**
     * @param {File} file
     * @param {EsignSigningParameters} params
     * @param {object} userText
     * @returns {Promise<EsignQualifiedSigningRequest>}
     */
    async createQualifiedSigningRequest(file, params = {}, userText = null) {
        let apiUrl = combineURLs(this._element.entryPointUrl, '/esign/qualified-signing-requests');
        let formData = new FormData();
        if (userText !== null) {
            formData.append('user_text', JSON.stringify(userText));
        }
        formData.append('file', file);
        for (let key in params) {
            formData.append(key, params[key]);
        }
        const result = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + this._element.auth.token,
                'Accept-Language': this._element.lang,
            },
            body: formData,
        });

        if (!result.ok) {
            throw await ApiError.fromResponse(result);
        }

        return await result.json();
    }

    /**
     * @param {EsignQualifiedBatchSigningRequestInput[]} files
     * @returns {Promise<EsignQualifiedBatchSigningRequest>}
     */
    async createQualifiedBatchSigningRequest(files) {
        let apiUrl = combineURLs(
            this._element.entryPointUrl,
            '/esign/qualified-batch-signing-requests',
        );
        let formData = new FormData();
        for (let {file, params = {}, userText = null} of files) {
            formData.append('files[]', file);
            const request =
                userText !== null ? {...params, user_text: JSON.stringify(userText)} : {...params};
            formData.append('requests[]', JSON.stringify(request));
        }
        const result = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + this._element.auth.token,
                'Accept-Language': this._element.lang,
            },
            body: formData,
        });

        if (!result.ok) {
            throw await ApiError.fromResponse(result);
        }

        return await result.json();
    }

    /**
     * @param {string} id
     * @returns {Promise<EsignQualifiedBatchSigningResult>}
     */
    async getQualifiedBatchSigningResult(id) {
        const apiUrl =
            combineURLs(this._element.entryPointUrl, '/esign/qualified-batch-signing-results') +
            '/' +
            encodeURIComponent(id);

        const result = await fetch(apiUrl, {
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: 'Bearer ' + this._element.auth.token,
                'Accept-Language': this._element.lang,
            },
        });

        if (!result.ok) {
            throw await ApiError.fromResponse(result);
        }

        return await result.json();
    }

    /**
     * @param {File} file
     * @param {EsignSigningParameters} params
     * @param {object} userText
     * @returns {Promise<EsignAdvancedlySignedDocument>}
     */
    async createAdvancedlySignedDocument(file, params = {}, userText = null) {
        let apiUrl = combineURLs(this._element.entryPointUrl, '/esign/advancedly-signed-documents');
        let formData = new FormData();
        if (userText !== null) {
            formData.append('user_text', JSON.stringify(userText));
        }
        formData.append('file', file);
        for (let key in params) {
            formData.append(key, params[key]);
        }
        const result = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + this._element.auth.token,
                'Accept-Language': this._element.lang,
            },
            body: formData,
        });

        if (!result.ok) {
            throw await ApiError.fromResponse(result);
        }

        return await result.json();
    }
}
