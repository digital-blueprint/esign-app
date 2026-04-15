import {css, html} from 'lit';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import * as commonUtils from '@dbp-toolkit/common/utils';

class PredefinedSignature extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._url = '';
        this._data = null;
        this._error = null;
        this._loading = false;
    }

    static get properties() {
        return {
            _url: {type: String, state: true},
            _data: {type: Object, state: true},
            _error: {type: String, state: true},
            _loading: {type: Boolean, state: true},
        };
    }

    connectedCallback() {
        super.connectedCallback();
        const hash = window.location.hash;
        if (hash && hash.length > 1) {
            const url = decodeURIComponent(hash.slice(1));
            this._url = url;
            this._fetchData(url);
        }
    }

    async _fetchData(url) {
        this._loading = true;
        this._data = null;
        this._error = null;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                this._error = `HTTP ${response.status}: ${response.statusText}`;
            } else {
                this._data = await response.json();
            }
        } catch (e) {
            this._error = e.message;
        } finally {
            this._loading = false;
        }
    }

    static get styles() {
        return css`
            pre {
                background: #f4f4f4;
                padding: 1em;
                overflow: auto;
                border-radius: 4px;
                font-size: 0.9em;
            }
            .error {
                color: red;
            }
            .url {
                word-break: break-all;
                font-size: 0.85em;
                color: #555;
                margin-bottom: 0.5em;
            }
        `;
    }

    render() {
        if (!this._url) {
            return html`
                <p>No URL provided in fragment.</p>
            `;
        }
        return html`
            <p class="url">URL: ${this._url}</p>
            ${this._loading
                ? html`
                      <p>Loading...</p>
                  `
                : ''}
            ${this._error
                ? html`
                      <p class="error">Error: ${this._error}</p>
                  `
                : ''}
            ${this._data
                ? html`
                      <pre>${JSON.stringify(this._data, null, 2)}</pre>
                  `
                : ''}
        `;
    }
}

commonUtils.defineCustomElement('dbp-predefined-signature', PredefinedSignature);
