import {html, css} from 'lit';
import {createInstance} from './i18n.js';
import {ScopedElementsMixin, IconButton, Icon} from '@dbp-toolkit/common';
import {TabulatorTable} from '@dbp-toolkit/tabulator-table';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';

export class CustomTabulatorTable extends TabulatorTable {
    static get scopedElements() {
        return {
            'dbp-esign-download-button': DownloadButton,
            'dbp-esign-filename-label': FilenameLabel,
        };
    }

    static get styles() {
        return [
            TabulatorTable.styles,
            // block needed for ResizeObserver
            css`
                :host {
                    display: block;
                }
            `,
        ];
    }

    _handleResize() {
        // XXX: Work around tabulator table losing elements when un-collapsing
        if (this.tabulatorTable && this.tabulatorTable.initialized) {
            this.tabulatorTable.redraw(true);
        }
    }

    connectedCallback() {
        super.connectedCallback();

        this._resizeObserver = new ResizeObserver(this._handleResize.bind(this));
        this._resizeObserver.observe(this);
    }

    disconnectedCallback() {
        this._resizeObserver.unobserve(this);
        this._resizeObserver.disconnect();

        super.disconnectedCallback();
    }
}

export class FilenameLabel extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.file = null;
        this.isDownloaded = false;
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            file: {type: Object, attribute: false},
            isDownloaded: {type: Boolean, reflect: true},
        };
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
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

    static get styles() {
        return css`
            :host {
                display: flex;
            }
            dbp-icon {
                font-size: 24px;
                margin-left: 20px;
                top: -0.1em;
            }
        `;
    }

    render() {
        let i18n = this._i18n;
        return html`
            <span>${this.file ? this.file.name : ``}</span>
            ${this.isDownloaded
                ? html`
                      <dbp-icon
                          name="download-complete"
                          title="${i18n.t('download-file-completed')}"
                          aria-label="${i18n.t('download-file-completed')}"></dbp-icon>
                  `
                : ``}
        `;
    }
}

export class DownloadButton extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
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

    render() {
        return html`
            <dbp-icon-button
                icon-name="download"
                class="download-button"
                aria-label="${this._i18n.t('download-file-button-title')}"
                title="${this._i18n.t('download-file-button-title')}"></dbp-icon-button>
        `;
    }
}
