import {LitElement, html, css} from "lit-element";

/**
 * Set the URL via setUrl(), reset via reset().
 * 
 * Emits two custom events:
 *  * signature-error with a "message"
 *  * signature-done with an "id"
 */
export class ExternalSignIFrame extends LitElement {

    constructor() {
        super();
        this._onReceiveIframeMessage = this._onReceiveIframeMessage.bind(this);
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
            this.dispatchEvent(new CustomEvent('signature-error', {
                detail: {
                    message: error,
                }
            }));
        } else if (data.type === 'pdf-as-callback') {
            this.dispatchEvent(new CustomEvent('signature-done', {
                detail: {
                    id: data.sessionId,
                }
            }));
        }
    }

    setUrl(url) {
        let iframe = this.renderRoot.querySelector("#iframe");
        iframe.src = url;
    }

    reset() {
        this.setUrl("about:blank");
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
        `;
    }

    render() {
        return html`
            <!-- "scrolling" is deprecated, but still seem to help -->
            <iframe id="iframe" scrolling="no"></iframe>
        `;
    }
}