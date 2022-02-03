import {LitElement, html, css} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {MiniSpinner} from '@dbp-toolkit/common';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';

/**
 * Set the URL via setUrl(), reset via reset().
 *
 * Emits two custom events:
 *  signature-error with a "message"
 *  signature-done with an "id"
 */
export class ExternalSignIFrame extends ScopedElementsMixin(LitElement) {
    constructor() {
        super();
        this._loading = false;
        this._onReceiveIframeMessage = this._onReceiveIframeMessage.bind(this);
    }

    static get scopedElements() {
        return {
            'dbp-mini-spinner': MiniSpinner,
        };
    }

    static get properties() {
        return {
            _loading: {type: Boolean, attribute: false},
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
        const data = event.data;
        if (data.type === 'pdf-as-error') {
            let error = data.error;
            if (data.cause) {
                error = `${error}: ${data.cause}`;
            }
            this.dispatchEvent(
                new CustomEvent('signature-error', {
                    detail: {
                        message: error,
                    },
                })
            );
        } else if (data.type === 'pdf-as-callback') {
            this.dispatchEvent(
                new CustomEvent('signature-done', {
                    detail: {
                        id: data.sessionId,
                    },
                })
            );
        }
    }

    setUrl(url) {
        let iframe = this.renderRoot.querySelector('#iframe');
        this._loading = true;
        iframe.src = url;
    }

    reset() {
        this.setUrl('about:blank');
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
        `;
    }

    render() {
        let onDone = (event) => {
            this._loading = false;
        };

        return html`
            ${this._loading
                ? html`
                      <dbp-mini-spinner></dbp-mini-spinner>
                  `
                : html``}
            <!-- "scrolling" is deprecated, but still seem to help -->
            <iframe
                id="iframe"
                class=${classMap({hidden: this._loading})}
                @load="${onDone}"
                @error="${onDone}"
                scrolling="no"></iframe>
        `;
    }
}
