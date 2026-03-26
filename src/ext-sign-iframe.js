import {LitElement, html, css} from 'lit';
import {createInstance} from './i18n.js';
import {classMap} from 'lit/directives/class-map.js';
import {MiniSpinner, LangMixin} from '@dbp-toolkit/common';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import {humanFileSize} from '@dbp-toolkit/common/i18next.js';
import {SignatureEntry} from './dbp-signature-lit-element.js';

/**
 * Set the URL via setUrl(), reset via reset().
 *
 * Emits two custom events:
 *  signature-error with a "message"
 *  signature-done with an "code"
 */
export class ExternalSignIFrame extends LangMixin(ScopedElementsMixin(LitElement), createInstance) {
    constructor() {
        super();
        this._done = true;
        this._locationCount = 0;
        this._onReceiveIframeMessage = this._onReceiveIframeMessage.bind(this);
        this._entries = [];
    }

    static get scopedElements() {
        return {
            'dbp-mini-spinner': MiniSpinner,
        };
    }

    static get properties() {
        return {
            _done: {type: Boolean, state: true},
            _locationCount: {type: Number, state: true},
        };
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('message', this._onReceiveIframeMessage);
    }

    disconnectedCallback() {
        window.removeEventListener('message', this._onReceiveIframeMessage);
        super.disconnectedCallback();
    }

    _onReceiveIframeMessage(event) {
        if (this._done) {
            return;
        }
        const data = event.data;
        if (data.type === 'pdf-as-error') {
            this._done = true;
            this._entries = [];
            let error = data.error;
            if (data.cause) {
                error = `${error}: ${data.cause}`;
            }
            this.dispatchEvent(
                new CustomEvent('signature-error', {
                    detail: {
                        message: error,
                    },
                }),
            );
        } else if (data.type === 'pdf-as-callback') {
            this._done = true;
            this._entries = [];
            this.dispatchEvent(
                new CustomEvent('signature-done', {
                    detail: {
                        // sessionId is deprecated since esign v0.5.0
                        code: data.code ?? data.sessionId,
                    },
                }),
            );
        }
    }

    /**
     * @param {string} url
     * @param {SignatureEntry[]} entries
     */
    setUrl(url, entries) {
        let iframe = /** @type {HTMLIFrameElement} */ (this.renderRoot.querySelector('#iframe'));
        this._done = false;
        this._entries = entries;
        this._locationCount = 0;
        iframe.src = url;
    }

    reset() {
        this.setUrl('about:blank', []);
        this._done = true;
    }

    static get styles() {
        return css`
            :host {
                display: inline-block;
            }

            #iframe {
                /* "overflow" should not be supported by browsers,
                  but some seem to use it */
                overflow: hidden;
                border-width: 0;
                width: 100%;
                height: 100%;
            }

            .hidden {
                display: none;
            }

            .title {
                overflow: hidden;
                text-overflow: ellipsis;
                margin-right: 0.5em;
            }
        `;
    }

    render() {
        let onLoad = (event) => {
            this._locationCount++;
        };

        let onError = (event) => {
            if (!this._done) {
                this._done = true;
                this._entries = [];
                this.dispatchEvent(
                    new CustomEvent('signature-error', {
                        detail: {
                            message: this._i18n.t('ext-sign.load-error'),
                        },
                    }),
                );
            }
        };

        // before the first load, we can hide things
        let loading = !this._done && this._locationCount < 1;
        let active = !this._done && !loading;

        // the third page is the signing one of the first document, then each
        // load is the next document until we are done, or we get redirected to
        // final result/error page
        let currentEntry = this._entries[this._locationCount - 3];
        const currentTitle = currentEntry
            ? this._i18n.t('ext-sign.current-title', {
                  fileName: currentEntry.file.name,
                  fileSize: humanFileSize(currentEntry.file.size, false),
              })
            : undefined;

        return html`
            ${loading
                ? html`
                      <dbp-mini-spinner></dbp-mini-spinner>
                  `
                : html``}
            <div class="title">
                ${currentTitle && active
                    ? html`
                          <p>${currentTitle}</p>
                      `
                    : html`
                          &nbsp;
                      `}
            </div>
            <!-- "scrolling" is deprecated, but still seem to help -->
            <iframe
                id="iframe"
                class=${classMap({hidden: !active})}
                @load="${onLoad}"
                @error="${onError}"
                scrolling="no"></iframe>
        `;
    }
}
