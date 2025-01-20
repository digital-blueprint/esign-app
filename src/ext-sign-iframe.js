import {LitElement, html, css} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {MiniSpinner} from '@dbp-toolkit/common';
import {ScopedElementsMixin} from '@dbp-toolkit/common';

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
        this.locationCount = 0;
        this.loginPageLoaded = false;
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
            locationCount: {type: Number, attribute: 'location-count', reflect: true},
            loginPageLoaded: {type: Boolean, attribute: 'login-page-loaded', reflect: true},
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
        let iframe = /** @type {HTMLIFrameElement} */ (this.renderRoot.querySelector('#iframe'));
        this._loading = true;
        iframe.src = url;
        this.locationCount = 0;
    }

    reset() {
        this.setUrl('about:blank');
        this.locationCount = 0;
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

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'locationCount':
                    this.loginPageLoaded = this.locationCount > 1;
                    break;
            }
        });

        super.update(changedProperties);
    }

    render() {
        let onDone = (event) => {
            this._loading = false;
            this.locationCount++;
        };

        let onError = (event) => {
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
                @error="${onError}"
                scrolling="no"></iframe>
        `;
    }
}
