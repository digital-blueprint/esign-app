import { LitElement, html, css } from 'lit';
import { createInstance } from './i18n.js';
import { ScopedElementsMixin, IconButton } from '@dbp-toolkit/common';
import { TabulatorTable } from '@dbp-toolkit/tabulator-table';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';


export class CustomTabulatorTable extends TabulatorTable {
    static get scopedElements() {
        return {
            'dbp-esign-download-button': DownloadButton,
            'dbp-esign-filename-label': FilenameLabel,
        };
    }
}

export class FilenameLabel extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.file = null;
    }

    static get properties() {
        return {
            ...super.properties,
            lang: { type: String },
            file: { type: Object, attribute: false },
        };
    }

    static get scopedElements() {
        return {
        };
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':
                    this._i18n.changeLanguage(this.lang);
                    break;
            }
        });

        super.update(changedProperties);
    }

    render() {
        return html`
            ${this.file ? this.file.name : ``}
    `;
    }
}

export class DownloadButton extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.file = null;
    }

    static get properties() {
        return {
            ...super.properties,
            lang: { type: String },
        };
    }

    static get scopedElements() {
        return {
            'dbp-icon-button': IconButton,
        };
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case 'lang':
                    this._i18n.changeLanguage(this.lang);
                    break;
            }
        });

        super.update(changedProperties);
    }

    _handleDownloadClick(event) {
        console.log(this.file);
    }

    render() {
        return html`
        <dbp-icon-button
            icon-name="download"
            class="download-button"
            aria-label="${this._i18n.t('download-file-button-title')}"
            title="${this._i18n.t('download-file-button-title')}"
            @click="${this._handleDownloadClick}"></dbp-icon-button>
    `;
    }
}