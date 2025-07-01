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
            'dbp-esign-preview-button': PreviewButton,
            'dbp-esign-delete-button': DeleteButton,
            'dbp-esign-annotations-button': AnnotationsButton,
            'dbp-esign-positioning-switch': PositioningSwitch,
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

export class PreviewButton extends LangMixin(ScopedElementsMixin(DBPLitElement), createInstance) {
    static get scopedElements() {
        return {
            'dbp-icon-button': IconButton,
        };
    }

    render() {
        return html`
            <dbp-icon-button
                icon-name="keyword-research"
                class="preview-button"
                aria-label="${this._i18n.t('preview-file-button-title')}"
                title="${this._i18n.t('preview-file-button-title')}"></dbp-icon-button>
        `;
    }
}

export class AnnotationsButton extends LangMixin(
    ScopedElementsMixin(DBPLitElement),
    createInstance,
) {
    static get scopedElements() {
        return {
            'dbp-icon-button': IconButton,
        };
    }

    static get properties() {
        return {
            annotations: {type: Array},
        };
    }

    static get styles() {
        return css`
            .annotation-wrapper {
                display: inline-grid;
                grid-template-columns: 27px 23px;
                grid-template-rows: 23px 27px;
                width: 50px;
                height: 50px;
                position: relative;
            }

            .annotation-button {
                font-size: 24px;
                grid-area: 1 / 1 / 3 / 3;
                place-self: center;
            }

            .annotation-plus {
                position: absolute;
                font-size: 19px;
                top: 21%;
                left: 40%;
                font-weight: bold;
                pointer-events: none;
            }

            .annotation-count {
                grid-column: 2 / 3;
                grid-row: 1 / 2;
                justify-self: start;
                align-self: end;
                background: var(--dbp-primary);
                color: var(--dbp-background);
                border: 1px solid var(--dbp-background);
                border-radius: 100%;
                display: block;
                width: 21px;
                height: 21px;
                text-align: center;
                line-height: 21px;
                font-size: 14px;
                font-weight: bold;
                z-index: 3;
                pointer-events: none;
            }
        `;
    }

    constructor() {
        super();
        this.annotations = [];
    }

    render() {
        return html`
            <span class="annotation-wrapper">
                <dbp-icon-button
                    icon-name="bubble"
                    class="annotation-button"
                    aria-label="${this._i18n.t('annotation-button-title')}"
                    title="${this._i18n.t('annotation-button-title')}"></dbp-icon-button>
                ${this.annotations.length < 1
                    ? html`
                          <span class="annotation-plus">+</span>
                      `
                    : html`
                          <span
                              class="annotation-count"
                              title="${this._i18n.t('annotations-count-text', {
                                  annotationCount: this.annotations.length,
                              })}">
                              ${this.annotations.length}
                          </span>
                      `}
            </span>
        `;
    }
}

export class DeleteButton extends LangMixin(ScopedElementsMixin(DBPLitElement), createInstance) {
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
                aria-label="${this._i18n.t('remove-queued-file-button-title')}"
                title="${this._i18n.t('remove-queued-file-button-title')}"></dbp-icon-button>
        `;
    }
}

export class PositioningSwitch extends LangMixin(
    ScopedElementsMixin(DBPLitElement),
    createInstance,
) {
    static get styles() {
        return css`
            .toggle-wrapper {
                --toggle-width: 80px;
                --toggle-height: 34px;
                --icon-width: 35px;
                --icon-height: 28px;
                --transition-time: 0.3s;
                --gap: 2px;
                --checkmark-color: var(--dbp-muted);
                --checkmark-color-need-positioning: var(--dbp-danger);
                --dbp-border-radius: 4px;
                overflow: hidden;
                position: relative;
                display: flex;
                align-items: center;
            }

            .toggle {
                position: relative;
                display: inline-block;
                padding: 0 8px;
            }

            .label-text {
                line-height: var(--toggle-height);
            }

            /* the switch */
            label.toggle-item {
                width: var(--toggle-width);
                background: var(--dbp-muted);
                color: var(--dbp-background);
                height: var(--toggle-height);
                display: block;
                border-radius: var(--dbp-border-radius);
                border: 1px solid var(--dbp-muted);
                position: relative;
                transition: all var(--transition-time) ease;
                cursor: pointer;
                margin: 0;
            }

            label.toggle-item.on {
                background-color: var(--dbp-info);
                border: 1px solid var(--dbp-info);
            }

            .label-off,
            .label-on {
                font-weight: bold;
                position: absolute;
                transition: opacity 0.1s ease;
                transition-delay: 0.3s;
                opacity: 1;
                height: var(--toggle-height);
                line-height: var(--toggle-height);
            }

            .label-off {
                /*left: calc(100% - var(--icon-size) - var(--gap));*/
                right: 6px;
            }

            .label-on {
                /*right: calc(100% - var(--icon-size) - var(--gap));*/
                left: 6px;
            }

            input {
                height: 40px;
                left: 0;
                opacity: 0;
                position: absolute;
                top: 0;
                width: 40px;
                margin: 0;
                padding: 0;
            }

            .toggle {
                /* keyboard focus visibility */
                .input-checkbox:focus-visible + .toggle-item {
                    box-shadow: 0px 0px 3px 1px var(--dbp-primary);
                }

                /* the button */
                .check {
                    border-radius: var(--dbp-border-radius);
                    width: var(--icon-width);
                    height: var(--icon-height);
                    position: absolute;
                    background: var(--dbp-background);
                    transition: 0.4s ease;
                    top: var(--gap);
                    bottom: var(--gap);
                    left: var(--gap);
                }
            }

            .need-positioning {
                label.toggle-item {
                    border-color: var(--checkmark-color-need-positioning);
                    background-color: var(--checkmark-color-need-positioning);
                    color: var(--dbp-background);
                }
            }

            .hidden {
                display: none;
            }

            .sr-only {
                position: absolute !important;
                clip: rect(1px, 1px, 1px, 1px);
                overflow: hidden;
                height: 1px;
                width: 1px;
                word-wrap: normal;
            }

            /* animation */
            .input-checkbox:checked + label {
                .check {
                    left: calc(100% - var(--icon-width) - var(--gap));
                }
            }
        `;
    }

    constructor() {
        super();
        this.needPositioning = false;
        this.checked = false;
    }

    static get properties() {
        return {
            needPositioning: {type: Boolean, attribute: 'need-positioning'},
            checked: {type: Boolean, reflect: true},
        };
    }

    _handleToggle(event) {
        this.checked = event.target.checked;

        this.dispatchEvent(
            new CustomEvent('toggle-change', {
                detail: {
                    checked: this.checked,
                },
                bubbles: true,
            }),
        );
    }

    render() {
        return html`
            <div class="toggle-wrapper">
                <div class="toggle ${this.needPositioning ? 'need-positioning' : ''}">
                    <input
                        id="toggle-input"
                        class="input-checkbox"
                        type="checkbox"
                        role="switch"
                        .checked="${this.checked}"
                        @change="${this._handleToggle}" />
                    <label class="toggle-item ${this.checked ? 'on' : 'off'}" for="toggle-input">
                        <span class="label-on" ?aria-hidden="${!this.checked}">
                            ${this._i18n.t('toggle-switch-label-text-on')}
                        </span>
                        <span class="label-off" ?aria-hidden="${this.checked}">
                            ${this._i18n.t('toggle-switch-label-text-off')}
                        </span>
                        <div class="check"></div>
                    </label>
                </div>
            </div>
        `;
    }
}
