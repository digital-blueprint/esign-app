import {css, html} from 'lit';
import {LangMixin, ScopedElementsMixin} from '@dbp-toolkit/common';
import {MiniSpinner, Icon} from '@dbp-toolkit/common';
import * as commonStyles from '@dbp-toolkit/common/styles';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {name as pkgName} from './../package.json';
import {createInstance} from './i18n.js';
import {BaseLitElement} from './base-element.js';
import {PdfPreview} from './dbp-pdf-preview.js';
import {EsignApi} from './api.js';

const STATE = {
    LOADING: 'loading',
    REVIEW: 'review',
    SIGNING: 'signing',
    DONE: 'done',
    ERROR: 'error',
};

class PredefinedSignature extends ScopedElementsMixin(LangMixin(BaseLitElement, createInstance)) {
    constructor() {
        super();
        this.entryPointUrl = '';
        this.lang = 'en';
        this._url = '';
        this._state = STATE.LOADING;
        this._tasks = [];
        this._currentTaskIndex = 0;
        this._signingIndex = 0;
        this._signingErrors = [];
        this._error = null;
        this._previewReady = false;
        this._api = new EsignApi(this);
    }

    static get scopedElements() {
        return {
            'dbp-pdf-preview': PdfPreview,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-icon': Icon,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            lang: {type: String},
            _state: {type: String, state: true},
            _tasks: {type: Array, state: true},
            _currentTaskIndex: {type: Number, state: true},
            _signingIndex: {type: Number, state: true},
            _signingErrors: {type: Array, state: true},
            _error: {type: String, state: true},
            _previewReady: {type: Boolean, state: true},
        };
    }

    connectedCallback() {
        super.connectedCallback();
        const hash = window.location.hash;
        if (hash && hash.length > 1) {
            const url = decodeURIComponent(hash.slice(1));
            this._url = url;
            this._fetchPlan(url);
        } else {
            this._state = STATE.ERROR;
            this._error = this._i18n.t('predefined-signature.no-url');
        }
    }

    async _fetchPlan(url) {
        this._state = STATE.LOADING;
        try {
            // Fetch the plan JSON — URL has its own signed tokens, no auth header needed
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const plan = await response.json();

            const i18n = this._i18n;
            const documents = plan?.data?.documents;
            if (!Array.isArray(documents) || documents.length === 0) {
                throw new Error(i18n.t('predefined-signature.error-no-documents'));
            }

            // Fetch each document PDF as a File object
            const tasks = await Promise.all(
                documents.map(async (doc, i) => {
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
                        doc.url.split('/').pop().split('?')[0] ||
                        `document-${i + 1}.pdf`;
                    const file = new File([blob], filename, {type: 'application/pdf'});
                    return {file, doc, confirmed: false};
                }),
            );

            this._tasks = tasks;
            this._currentTaskIndex = 0;
            this._state = STATE.REVIEW;
        } catch (e) {
            this._error = this._i18n.t('predefined-signature.error-fetch-plan', {
                message: e.message,
            });
            this._state = STATE.ERROR;
        }
    }

    async updated(changedProperties) {
        super.updated(changedProperties);

        // When we enter review state or switch to a new task, load the PDF into the preview
        if (this._state === STATE.REVIEW) {
            const needsLoad =
                changedProperties.has('_state') ||
                changedProperties.has('_currentTaskIndex') ||
                changedProperties.has('_previewReady');

            if (needsLoad) {
                await this._loadPreview();
            }
        }
    }

    async _loadPreview() {
        const task = this._tasks[this._currentTaskIndex];
        if (!task) return;

        // Wait for our own render to finish
        await this.updateComplete;
        const preview = this._('dbp-pdf-preview');
        if (!preview) return;

        // The preview initialises its fabricCanvas asynchronously inside its own
        // connectedCallback → updateComplete.then(). Poll until it is ready.
        await new Promise((resolve) => {
            const check = () => {
                if (preview.fabricCanvas !== null) {
                    resolve();
                } else {
                    requestAnimationFrame(check);
                }
            };
            check();
        });

        const {doc, file} = task;

        // Build the entry object showEntry() expects.
        // We omit scaleX/scaleY so showPage() runs its initSignature branch, which
        // correctly sizes the block from the signature-width/height mm attributes.
        // left/top are set before showPage runs so they get overwritten by initSignature
        // anyway — the preview just shows the sig block at its default position, which is
        // fine for view-only. The actual x/y from the JSON are used for signing.
        const entry = {
            file,
            annotations: [],
            placementMode: 'manual',
            signaturePlacement: {
                currentPage: doc.page ?? 1,
            },
        };

        await preview.showEntry(entry, /* isShowPlacement */ false, /* viewOnly */ true);
    }

    _confirmCurrent() {
        const tasks = this._tasks.map((t, i) =>
            i === this._currentTaskIndex ? {...t, confirmed: true} : t,
        );
        this._tasks = tasks;

        // All confirmed — start signing
        if (tasks.every((t) => t.confirmed)) {
            this._signAll();
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
        if (index < 0 || index >= this._tasks.length) return;
        this._currentTaskIndex = index;
    }

    _goToSignaturePage() {
        const task = this._tasks[this._currentTaskIndex];
        if (!task) return;
        const preview = this._('dbp-pdf-preview');
        if (preview) preview.showPage(task.doc.page ?? 1);
    }

    _openInNewTab() {
        const task = this._tasks[this._currentTaskIndex];
        if (!task) return;
        window.open(task.doc.url, '_blank', 'noopener');
    }

    _cancelSigning() {
        this._state = STATE.ERROR;
        this._error = this._i18n.t('predefined-signature.error-cancelled');
    }

    async _signAll() {
        this._state = STATE.SIGNING;
        this._signingIndex = 0;
        this._signingErrors = [];

        for (let i = 0; i < this._tasks.length; i++) {
            this._signingIndex = i;
            const {file, doc} = this._tasks[i];

            const params = {
                profile: 'official',
                x: doc.x,
                y: doc.y,
                page: doc.page ?? 1,
            };

            try {
                await this._api.createAdvancedlySignedDocument(file, params, null);
            } catch (e) {
                this._signingErrors = [
                    ...this._signingErrors,
                    {filename: file.name, message: e.message},
                ];
            }
        }

        this._state = STATE.DONE;
    }

    static get styles() {
        return [
            commonStyles.getThemeCSS(),
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

                .error-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }

                .error-list li {
                    color: var(--dbp-danger, red);
                    margin-bottom: 0.25em;
                }

                dbp-pdf-preview {
                    display: block;
                    max-width: 800px;
                }
            `,
        ];
    }

    render() {
        const i18n = this._i18n;
        switch (this._state) {
            case STATE.LOADING:
                return html`
                    <div class="state-loading">
                        <dbp-mini-spinner></dbp-mini-spinner>
                        <span>${i18n.t('predefined-signature.loading')}</span>
                    </div>
                `;

            case STATE.REVIEW: {
                const task = this._tasks[this._currentTaskIndex];
                if (!task) return html``;
                const total = this._tasks.length;
                const current = this._currentTaskIndex + 1;
                const placeholderUrl = commonUtils.getAssetURL(
                    pkgName,
                    'official-signature-placeholder.png',
                );
                const prevIdx = this._currentTaskIndex - 1;
                const nextIdx = this._currentTaskIndex + 1;
                return html`
                    <div class="review-header">
                        <span class="filename">${task.file.name}</span>
                        <span class="progress">
                            ${i18n.t('predefined-signature.document-progress', {current, total})}
                            ${task.confirmed
                                ? html`
                                      &#10003;
                                  `
                                : ''}
                        </span>
                    </div>
                    <div class="review-actions">
                        ${total > 1
                            ? html`
                                  <button
                                      class="btn btn-secondary"
                                      title="${i18n.t('predefined-signature.prev-document')}"
                                      ?disabled="${prevIdx < 0}"
                                      @click="${() => this._navigateTo(prevIdx)}">
                                      &lt;&lt;
                                  </button>
                              `
                            : ''}
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
                        ${total > 1
                            ? html`
                                  <button
                                      class="btn btn-secondary"
                                      title="${i18n.t('predefined-signature.next-document')}"
                                      ?disabled="${nextIdx >= total}"
                                      @click="${() => this._navigateTo(nextIdx)}">
                                      &gt;&gt;
                                  </button>
                              `
                            : ''}
                    </div>
                    <dbp-pdf-preview
                        lang="${this.lang}"
                        signature-placeholder-image-src="${placeholderUrl}"
                        don-t-show-buttons></dbp-pdf-preview>
                `;
            }

            case STATE.SIGNING:
                return html`
                    <div class="signing-status">
                        <dbp-mini-spinner></dbp-mini-spinner>
                        <span>
                            ${i18n.t('predefined-signature.signing', {
                                current: this._signingIndex + 1,
                                total: this._tasks.length,
                            })}
                        </span>
                    </div>
                `;

            case STATE.DONE:
                return html`
                    <div class="state-done">
                        <dbp-icon name="checkmark-circle" style="font-size:2em"></dbp-icon>
                        <p>${i18n.t('predefined-signature.done', {count: this._tasks.length})}</p>
                        ${this._signingErrors.length > 0
                            ? html`
                                  <p>${i18n.t('predefined-signature.done-with-errors')}</p>
                                  <ul class="error-list">
                                      ${this._signingErrors.map(
                                          (e) => html`
                                              <li>${e.filename}: ${e.message}</li>
                                          `,
                                      )}
                                  </ul>
                              `
                            : ''}
                    </div>
                `;

            case STATE.ERROR:
            default:
                return html`
                    <div class="state-error">
                        <dbp-icon name="warning-circle" style="font-size:2em"></dbp-icon>
                        <p>${this._error}</p>
                    </div>
                `;
        }
    }
}

commonUtils.defineCustomElement('dbp-predefined-signature', PredefinedSignature);
