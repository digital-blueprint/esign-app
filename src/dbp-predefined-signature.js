import {css, html} from 'lit';
import {keyed} from 'lit/directives/keyed.js';
import {LangMixin, ScopedElementsMixin} from '@dbp-toolkit/common';
import {MiniSpinner, Icon} from '@dbp-toolkit/common';
import {FileSink} from '@dbp-toolkit/file-handling';
import * as commonStyles from '@dbp-toolkit/common/styles';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {createInstance} from './i18n.js';
import {BaseLitElement} from './base-element.js';
import {PdfPreview} from './dbp-pdf-preview.js';
import {EsignApi} from './api.js';
import * as utils from './utils.js';

/** @typedef {import('./api.js').EsignProfile} EsignProfile */
/** @typedef {import('./api.js').EsignSigningParameters} EsignSigningParameters */

/**
 * @typedef {object} PlanDocument
 * @property {string} url - URL of the PDF to sign
 * @property {string} [filename]
 * @property {string} [profile] - the signature profile to use
 * @property {number} [x] - PDF-AS position, if not set the profile default is used
 * @property {number} [y]
 * @property {number} [page]
 * @property {number} [width]
 * @property {number} [rotation]
 * @property {string} [workflowTrackingId]
 */

/**
 * @typedef {object} PositionData
 * @property {number} x
 * @property {number} y
 * @property {number} page
 * @property {number} [width]
 * @property {number} [rotation]
 */

/**
 * @typedef {object} SigningTask
 * @property {File} file
 * @property {PlanDocument} doc
 * @property {string} profileId
 * @property {PositionData|null} position
 * @property {boolean} confirmed
 * @property {File|null} signedFile
 * @property {string|null} error
 */

const STATE = {
    LOADING: 'loading',
    REVIEW: 'review',
    SIGNING: 'signing',
    DONE: 'done',
    ERROR: 'error',
};

// Query parameter containing the (signed) URL of the plan
const PLAN_URL_PARAM = 'plan';

// Used if the plan doesn't specify a profile for a document
const DEFAULT_PROFILE = 'official';

// How long to wait for the preview to initialize before giving up
const PREVIEW_INIT_TIMEOUT_MS = 30000;

class PredefinedSignature extends ScopedElementsMixin(LangMixin(BaseLitElement, createInstance)) {
    constructor() {
        super();
        this.entryPointUrl = '';
        this.lang = 'en';
        /** @type {string|null} */
        this._url = null;
        this._state = STATE.LOADING;
        /** @type {SigningTask[]|null} */
        this._tasks = null;
        /** @type {Record<string, EsignProfile>|null} */
        this._profiles = null;
        /** @type {Set<string>} */
        this._qualifiedProfiles = new Set();
        this._currentTaskIndex = 0;
        this._signingIndex = 0;
        this._error = null;
        this._previewToken = 0;
        this._api = new EsignApi(this);
    }

    static get scopedElements() {
        return {
            'dbp-pdf-preview': PdfPreview,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-icon': Icon,
            'dbp-file-sink': FileSink,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            lang: {type: String},
            _state: {type: String, state: true},
            _tasks: {type: Array, state: true},
            _profiles: {type: Object, state: true},
            _currentTaskIndex: {type: Number, state: true},
            _signingIndex: {type: Number, state: true},
            _error: {type: String, state: true},
        };
    }

    /**
     * Returns the plan URL passed to the activity, either via the "plan" query parameter,
     * or (deprecated) as the URL-encoded fragment.
     *
     * @returns {string}
     */
    _getPlanUrlFromRouting() {
        const {queryParams, fragment} = this.getRoutingData();
        const url = queryParams.get(PLAN_URL_PARAM);
        if (url !== null) {
            return url;
        }
        // Legacy links: <activity>#<url-encoded plan url>
        return fragment !== '' ? decodeURIComponent(fragment) : '';
    }

    /**
     * Loads the plan if the plan URL has changed
     */
    _onRoutingUrlChanged() {
        // The routing URL is set by the app shell, it's empty until then
        if (this.routingUrl === '') {
            return;
        }
        const url = this._getPlanUrlFromRouting();
        if (url === this._url) {
            return;
        }
        this._url = url;
        if (url === '') {
            this._setError(this._i18n.t('predefined-signature.no-url'));
            return;
        }
        this._tasks = null;
        this._error = null;
        this._state = STATE.LOADING;
        void this._fetchPlan(url);
    }

    loginCallback() {
        void this._fetchProfiles();
    }

    _onLoginClicked(e) {
        this.sendSetPropertyEvent('requested-login-status', 'logged-in');
        e.preventDefault();
    }

    /**
     * @param {string} message
     */
    _setError(message) {
        this._error = message;
        this._state = STATE.ERROR;
    }

    async _fetchProfiles() {
        try {
            const [advanced, qualified] = await Promise.all([
                this._api.getProfiles('advanced'),
                this._api.getProfiles('qualified'),
            ]);
            /** @type {Record<string, EsignProfile>} */
            const profiles = {};
            for (const profile of advanced) {
                profiles[profile.identifier] = profile;
            }
            this._qualifiedProfiles = new Set(qualified.map((p) => p.identifier));
            this._profiles = profiles;
            this._checkReady();
        } catch (e) {
            this._setError(
                this._i18n.t('predefined-signature.error-fetch-profiles', {
                    message: e.detail ?? e.message,
                }),
            );
        }
    }

    /**
     * Extracts the PDF-AS position from a plan document. Returns null if no
     * position is given, in which case the profile default is used.
     *
     * @param {PlanDocument} doc
     * @param {number} index
     * @returns {PositionData|null}
     */
    _parsePosition(doc, index) {
        if (doc.x === undefined && doc.y === undefined) {
            return null;
        }

        /** @type {Record<string, number>} */
        const values = {};
        for (const key of ['x', 'y', 'page', 'width', 'rotation']) {
            if (doc[key] === undefined || doc[key] === null) {
                continue;
            }
            const value = Number(doc[key]);
            if (!Number.isFinite(value)) {
                throw new Error(
                    this._i18n.t('predefined-signature.error-invalid-position', {
                        index: index + 1,
                    }),
                );
            }
            values[key] = value;
        }
        if (values.x === undefined || values.y === undefined) {
            throw new Error(
                this._i18n.t('predefined-signature.error-invalid-position', {index: index + 1}),
            );
        }

        /** @type {PositionData} */
        const position = {x: values.x, y: values.y, page: values.page ?? 1};
        if (values.width !== undefined) {
            position.width = values.width;
        }
        if (values.rotation !== undefined) {
            position.rotation = values.rotation;
        }
        return position;
    }

    /**
     * @param {string} url
     */
    async _fetchPlan(url) {
        const i18n = this._i18n;
        try {
            // Fetch the plan JSON — URL has its own signed tokens, no auth header needed
            const response = await fetch(url, {headers: {Accept: 'application/json'}});
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const plan = await response.json();

            /** @type {PlanDocument[]} */
            const documents = plan?.data?.documents;
            if (!Array.isArray(documents) || documents.length === 0) {
                throw new Error(i18n.t('predefined-signature.error-no-documents'));
            }

            // Fetch each document PDF as a File object
            const tasks = await Promise.all(
                documents.map(async (doc, i) => {
                    const position = this._parsePosition(doc, i);
                    const pdfResponse = await fetch(doc.url);
                    if (!pdfResponse.ok) {
                        throw new Error(
                            i18n.t('predefined-signature.error-fetch-document', {
                                index: i + 1,
                                message: `HTTP ${pdfResponse.status}`,
                            }),
                        );
                    }
                    const blob = await pdfResponse.blob();
                    const filename =
                        doc.filename ||
                        doc.url.split('/').pop()?.split('?')[0] ||
                        `document-${i + 1}.pdf`;
                    const file = new File([blob], filename, {type: 'application/pdf'});
                    return {
                        file,
                        doc,
                        profileId: doc.profile || DEFAULT_PROFILE,
                        position,
                        confirmed: false,
                        signedFile: null,
                        error: null,
                    };
                }),
            );
            // The plan URL has changed in the meantime
            if (url !== this._url) return;
            this._tasks = tasks;
            this._checkReady();
        } catch (e) {
            if (url !== this._url) return;
            this._setError(i18n.t('predefined-signature.error-fetch-plan', {message: e.message}));
        }
    }

    /**
     * Switches to the review state once both the plan and the profiles are loaded,
     * and makes sure the user is allowed to use all required profiles.
     */
    _checkReady() {
        if (this._state !== STATE.LOADING || this._tasks === null || this._profiles === null) {
            return;
        }

        const i18n = this._i18n;
        for (const task of this._tasks) {
            const profileId = task.profileId;
            if (this._profiles[profileId] !== undefined) {
                continue;
            }
            if (this._qualifiedProfiles.has(profileId)) {
                this._setError(
                    i18n.t('predefined-signature.error-profile-qualified', {profile: profileId}),
                );
            } else {
                this._setError(
                    i18n.t('predefined-signature.error-profile-not-allowed', {
                        profile: profileId,
                    }),
                );
            }
            return;
        }

        this._currentTaskIndex = 0;
        this._state = STATE.REVIEW;
    }

    /**
     * @param {SigningTask} task
     * @returns {EsignProfile}
     */
    _getProfile(task) {
        if (this._profiles === null || this._profiles[task.profileId] === undefined) {
            throw new Error(`Unknown profile: ${task.profileId}`);
        }
        return this._profiles[task.profileId];
    }

    /**
     * @param {SigningTask} task
     * @returns {boolean}
     */
    _isInvisible(task) {
        return this._getProfile(task).invisible;
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        if (changedProperties.has('routingUrl')) {
            this._onRoutingUrlChanged();
        }

        // When we enter review state or switch to a new task, load the PDF into the preview
        if (this._state === STATE.REVIEW) {
            const needsLoad =
                changedProperties.has('_state') || changedProperties.has('_currentTaskIndex');

            if (needsLoad) {
                void this._loadPreview();
            }
        }
    }

    async _loadPreview() {
        const token = ++this._previewToken;
        const task = this._tasks?.[this._currentTaskIndex];
        if (!task) return;

        // Wait for our own render to finish
        await this.updateComplete;
        const preview = /** @type {PdfPreview|null} */ (this._('dbp-pdf-preview'));
        if (!preview) return;

        // The preview initialises its fabricCanvas asynchronously inside its own
        // connectedCallback → updateComplete.then(). Poll until it is ready.
        const ready = await new Promise((resolve) => {
            const start = Date.now();
            const check = () => {
                if (token !== this._previewToken) {
                    resolve(false);
                } else if (preview.fabricCanvas !== null) {
                    resolve(true);
                } else if (Date.now() - start > PREVIEW_INIT_TIMEOUT_MS) {
                    console.error('Timeout while waiting for the PDF preview');
                    resolve(false);
                } else {
                    requestAnimationFrame(check);
                }
            };
            check();
        });
        if (!ready) return;

        const showSignature = !this._isInvisible(task) && task.position !== null;

        /** @type {Record<string, unknown>} */
        const entry = {
            file: task.file,
            annotations: [],
            placementMode: showSignature ? 'manual' : 'auto',
        };
        if (showSignature && task.position !== null) {
            entry.signaturePlacement = {currentPage: task.position.page};
            entry.signaturePosition = task.position;
        }

        await preview.showEntry(entry, /* isShowPlacement */ false, /* viewOnly */ true);
    }

    _confirmCurrent() {
        if (this._tasks === null) return;
        const tasks = this._tasks.map((t, i) =>
            i === this._currentTaskIndex ? {...t, confirmed: true} : t,
        );
        this._tasks = tasks;

        // All confirmed — start signing
        if (tasks.every((t) => t.confirmed)) {
            void this._signAll();
            return;
        }

        // Find the next unconfirmed task, wrapping around
        const total = tasks.length;
        for (let offset = 1; offset < total; offset++) {
            const idx = (this._currentTaskIndex + offset) % total;
            if (!tasks[idx].confirmed) {
                this._currentTaskIndex = idx;
                return;
            }
        }
    }

    _navigateTo(index) {
        if (this._tasks === null || index < 0 || index >= this._tasks.length) return;
        this._currentTaskIndex = index;
    }

    _goToSignaturePage() {
        const task = this._tasks?.[this._currentTaskIndex];
        if (!task) return;
        const preview = /** @type {PdfPreview|null} */ (this._('dbp-pdf-preview'));
        if (preview) void preview.showPage(task.position?.page ?? 1);
    }

    _openInNewTab() {
        const task = this._tasks?.[this._currentTaskIndex];
        if (!task) return;
        const url = URL.createObjectURL(task.file);
        window.open(url, '_blank', 'noopener');
        // give the new tab some time to load the document
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    _cancelSigning() {
        this._setError(this._i18n.t('predefined-signature.error-cancelled'));
    }

    /**
     * @param {SigningTask} task
     * @returns {EsignSigningParameters}
     */
    _getSigningParams(task) {
        /** @type {EsignSigningParameters} */
        const params = {profile: task.profileId};
        // Invisible profiles don't accept any position
        if (task.position !== null && !this._isInvisible(task)) {
            Object.assign(params, task.position);
        }
        return params;
    }

    async _signAll() {
        if (this._tasks === null) return;
        this._state = STATE.SIGNING;
        this._signingIndex = 0;

        const tasks = [...this._tasks];
        for (let i = 0; i < tasks.length; i++) {
            this._signingIndex = i;
            const task = tasks[i];
            try {
                const signedDocument = await this._api.createAdvancedlySignedDocument(
                    task.file,
                    this._getSigningParams(task),
                    null,
                );
                const signedFile = new File(
                    [utils.convertDataURIToBinary(signedDocument.contentUrl)],
                    utils.generateSignedFileName(task.file.name),
                    {type: utils.getDataURIContentType(signedDocument.contentUrl)},
                );
                tasks[i] = {...task, signedFile, error: null};
            } catch (e) {
                tasks[i] = {...task, signedFile: null, error: e.detail ?? e.message};
            }
            this._tasks = [...tasks];
        }

        this._state = STATE.DONE;
    }

    /**
     * @returns {File[]}
     */
    _getSignedFiles() {
        return (this._tasks ?? [])
            .map((t) => t.signedFile)
            .filter((f) => f !== null)
            .map((f) => /** @type {File} */ (f));
    }

    /**
     * @param {File[]} files
     */
    _download(files) {
        const sink = /** @type {FileSink|null} */ (this._('#file-sink'));
        if (sink && files.length > 0) {
            sink.files = [...files];
        }
    }

    static get styles() {
        return [
            commonStyles.getThemeCSS(),
            commonStyles.getGeneralCSS(false),
            commonStyles.getNotificationCSS(),
            css`
                :host {
                    display: block;
                    padding: 1em;
                    font-family: inherit;
                }

                .state-loading,
                .state-error,
                .state-done {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 0.5em;
                }

                .state-error p {
                    color: var(--dbp-danger, red);
                }

                .review-header {
                    display: flex;
                    align-items: baseline;
                    gap: 1em;
                    margin-bottom: 0.75em;
                }

                .review-header .filename {
                    font-weight: bold;
                    font-size: 1.1em;
                }

                .review-header .progress {
                    color: var(--dbp-muted, #666);
                    font-size: 0.9em;
                }

                .review-actions {
                    display: flex;
                    gap: 0.75em;
                    margin-bottom: 0.75em;
                    width: 100%;
                    justify-content: space-between;
                }

                .btn {
                    padding: 0.5em 1.25em;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 1em;
                }

                .btn-primary {
                    background: var(--dbp-primary, #2a6ebb);
                    color: var(--dbp-primary-text, #fff);
                }

                .btn-secondary {
                    background: transparent;
                    color: var(--dbp-danger, #c00);
                    border: 1px solid var(--dbp-danger, #c00);
                }

                .btn:disabled {
                    opacity: 0.3;
                    cursor: default;
                }

                .signing-status {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5em;
                }

                .result-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5em;
                }

                .result-list li {
                    display: flex;
                    align-items: center;
                    gap: 0.75em;
                }

                .result-list .error {
                    color: var(--dbp-danger, red);
                }

                dbp-pdf-preview {
                    display: block;
                    max-width: 800px;
                }
            `,
        ];
    }

    _renderReviewState() {
        const i18n = this._i18n;
        const tasks = this._tasks ?? [];
        const task = tasks[this._currentTaskIndex];
        if (!task) return html``;
        const total = tasks.length;
        const current = this._currentTaskIndex + 1;
        const prevIdx = this._currentTaskIndex - 1;
        const nextIdx = this._currentTaskIndex + 1;
        const profile = this._getProfile(task);
        return html`
            <div class="review-header">
                <span class="filename">${task.file.name}</span>
                <span class="progress">
                    ${i18n.t('predefined-signature.document-progress', {current, total})}
                    ${
                        task.confirmed
                            ? html`
                                  &#10003;
                              `
                            : ''
                    }
                </span>
            </div>
            <div class="review-actions">
                ${
                    total > 1
                        ? html`
                              <button
                                  class="btn btn-secondary"
                                  title="${i18n.t('predefined-signature.prev-document')}"
                                  ?disabled="${prevIdx < 0}"
                                  @click="${() => this._navigateTo(prevIdx)}">
                                  &lt;&lt;
                              </button>
                          `
                        : ''
                }
                <button class="btn btn-primary" @click="${this._confirmCurrent}">
                    ${i18n.t('predefined-signature.confirm-button')}
                </button>
                <button class="btn btn-secondary" @click="${this._goToSignaturePage}">
                    ${i18n.t('predefined-signature.go-to-signature-page')}
                </button>
                <button class="btn btn-secondary" @click="${this._openInNewTab}">
                    ${i18n.t('predefined-signature.open-in-new-tab')}
                </button>
                <button class="btn btn-secondary" @click="${this._cancelSigning}">
                    ${i18n.t('predefined-signature.cancel-button')}
                </button>
                ${
                    total > 1
                        ? html`
                              <button
                                  class="btn btn-secondary"
                                  title="${i18n.t('predefined-signature.next-document')}"
                                  ?disabled="${nextIdx >= total}"
                                  @click="${() => this._navigateTo(nextIdx)}">
                                  &gt;&gt;
                              </button>
                          `
                        : ''
                }
            </div>
            ${keyed(
                `${task.profileId}`,
                html`
                    <dbp-pdf-preview
                        .auth="${this.auth}"
                        lang="${this.lang}"
                        entry-point-url="${this.entryPointUrl}"
                        profile-id="${task.profileId}"
                        profile-lang="${profile.language}"
                        ?signature-invisible="${profile.invisible}"></dbp-pdf-preview>
                `,
            )}
        `;
    }

    _renderDoneState() {
        const i18n = this._i18n;
        const tasks = this._tasks ?? [];
        const signedFiles = this._getSignedFiles();
        const failed = tasks.filter((t) => t.error !== null);
        return html`
            <div class="state-done">
                <dbp-icon
                    name="${failed.length > 0 ? 'warning-circle' : 'checkmark-circle'}"
                    style="font-size:2em"></dbp-icon>
                <p>${i18n.t('predefined-signature.done', {count: signedFiles.length})}</p>
                ${
                    failed.length > 0
                        ? html`
                              <p>${i18n.t('predefined-signature.done-with-errors')}</p>
                          `
                        : ''
                }
                <ul class="result-list">
                    ${tasks.map(
                        (task) => html`
                            <li>
                                <span>${task.signedFile?.name ?? task.file.name}</span>
                                ${
                                    task.signedFile !== null
                                        ? html`
                                              <button
                                                  class="btn btn-secondary"
                                                  @click="${() =>
                                                      this._download([
                                                          /** @type {File} */ (task.signedFile),
                                                      ])}">
                                                  ${i18n.t('predefined-signature.download')}
                                              </button>
                                          `
                                        : html`
                                              <span class="error">${task.error}</span>
                                          `
                                }
                            </li>
                        `,
                    )}
                </ul>
                ${
                    signedFiles.length > 1
                        ? html`
                              <button
                                  class="btn btn-primary"
                                  @click="${() => this._download(signedFiles)}">
                                  ${i18n.t('predefined-signature.download-all')}
                              </button>
                          `
                        : ''
                }
            </div>
            <dbp-file-sink
                id="file-sink"
                filename="signed-documents.zip"
                enabled-targets="local"
                lang="${this.lang}"></dbp-file-sink>
        `;
    }

    render() {
        const i18n = this._i18n;

        if (this._state === STATE.ERROR) {
            return html`
                <div class="state-error">
                    <dbp-icon name="warning-circle" style="font-size:2em"></dbp-icon>
                    <p>${this._error}</p>
                </div>
            `;
        }

        if (this.isLoading()) {
            return html`
                <dbp-mini-spinner></dbp-mini-spinner>
            `;
        }

        if (!this.isLoggedIn()) {
            return html`
                <div class="notification is-warning">
                    ${i18n.t('error-login-message')}
                    <a href="#" @click="${this._onLoginClicked}">${i18n.t('error-login-link')}</a>
                </div>
            `;
        }

        switch (this._state) {
            case STATE.LOADING:
                return html`
                    <div class="state-loading">
                        <dbp-mini-spinner></dbp-mini-spinner>
                        <span>${i18n.t('predefined-signature.loading')}</span>
                    </div>
                `;

            case STATE.REVIEW:
                return this._renderReviewState();

            case STATE.SIGNING:
                return html`
                    <div class="signing-status">
                        <dbp-mini-spinner></dbp-mini-spinner>
                        <span>
                            ${i18n.t('predefined-signature.signing', {
                                current: this._signingIndex + 1,
                                total: this._tasks?.length ?? 0,
                            })}
                        </span>
                    </div>
                `;

            case STATE.DONE:
            default:
                return this._renderDoneState();
        }
    }
}

commonUtils.defineCustomElement('dbp-predefined-signature', PredefinedSignature);
