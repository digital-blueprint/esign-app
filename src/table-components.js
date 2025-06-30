import {html, css} from 'lit';
import {createInstance} from './i18n.js';
import {ScopedElementsMixin, IconButton, Icon, LangMixin} from '@dbp-toolkit/common';
import {TabulatorTable} from '@dbp-toolkit/tabulator-table';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {TooltipElement} from '@dbp-toolkit/tooltip';

export class CustomTabulatorTable extends TabulatorTable {
    static get scopedElements() {
        return {
            'dbp-esign-download-button': DownloadButton,
            'dbp-esign-filename-label': FilenameLabel,
            'dbp-esign-reupload-button': ReUploadButton,
            'dbp-esign-remove-failed-file-button': RemoveFailedFileButton,
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

export class FilenameLabel extends LangMixin(ScopedElementsMixin(DBPLitElement), createInstance) {
    constructor() {
        super();
        this.file = null;
        this.isDownloaded = false;
        this.isPlacementMissing = false;
    }

    static get properties() {
        return {
            ...super.properties,
            file: {type: Object, attribute: false},
            isDownloaded: {type: Boolean, reflect: true},
            isPlacementMissing: {type: Boolean, reflect: true},
        };
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-tooltip': TooltipElement,
        };
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
            dbp-tooltip {
                font-size: 24px;
                margin-bottom: 4px;
                margin-left: 10px;
            }
        `;
    }

    render() {
        let i18n = this._i18n;
        return html`
            <span>${this.file ? this.file.name : ``}</span>
            ${this.isPlacementMissing
                ? html`
                      <dbp-tooltip
                          text-content="${i18n.t('label-manual-positioning-missing')}"
                          icon-name="warning-high"
                          role="tooltip"
                          aria-label="${i18n.t('label-manual-positioning-missing')}"></dbp-tooltip>
                  `
                : ''}
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

export class DownloadButton extends LangMixin(ScopedElementsMixin(DBPLitElement), createInstance) {
    static get scopedElements() {
        return {
            'dbp-icon-button': IconButton,
        };
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

export class ReUploadButton extends LangMixin(ScopedElementsMixin(DBPLitElement), createInstance) {
    static get scopedElements() {
        return {
            'dbp-icon-button': IconButton,
        };
    }

    render() {
        return html`
            <dbp-icon-button
                icon-name="reload"
                class="re-upload-button"
                aria-label="${this._i18n.t('re-upload-file-button-title')}"
                title="${this._i18n.t('re-upload-file-button-title')}"></dbp-icon-button>
        `;
    }
}

export class RemoveFailedFileButton extends LangMixin(
    ScopedElementsMixin(DBPLitElement),
    createInstance,
) {
    static get scopedElements() {
        return {
            'dbp-icon-button': IconButton,
        };
    }

    render() {
        return html`
            <dbp-icon-button
                icon-name="trash"
                class="delete-button"
                aria-label="${this._i18n.t('remove-failed-file-button-title')}"
                title="${this._i18n.t('remove-failed-file-button-title')}"></dbp-icon-button>
        `;
    }
}
