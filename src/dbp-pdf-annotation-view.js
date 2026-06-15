import {createInstance} from './i18n.js';
import {css, html} from 'lit';
import {ScopedElementsMixin, LangMixin} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {MiniSpinner, Icon, Button} from '@dbp-toolkit/common';
import {ResourceSelect} from '@dbp-toolkit/resource-select';
import {send} from '@dbp-toolkit/common/notification';
import * as commonStyles from '@dbp-toolkit/common/styles';
import * as utils from './utils';
import {createRef} from 'lit/directives/ref.js';

/**
 * PdfAnnotationView web component
 */
export class PdfAnnotationView extends LangMixin(
    ScopedElementsMixin(DBPLitElement),
    createInstance,
) {
    constructor() {
        super();
        this.isTextHidden = false;
        this.enableRemoveAll = false;
        this.isSelected = false;
        this.annotationRows = [];
        this.key = -1;
        this.modalRef = createRef();
    }

    static get scopedElements() {
        return {
            'dbp-mini-spinner': MiniSpinner,
            'dbp-icon': Icon,
            'dbp-resource-select': ResourceSelect,
            'dbp-button': Button,
        };
    }

    /**
     * See: https://lit-element.polymer-project.org/guide/properties#initialize
     */
    static get properties() {
        return {
            ...super.properties,
            key: {type: Number},
            isTextHidden: {type: Boolean, attribute: false},
            isSelected: {type: Boolean, attribute: false},
            annotationRows: {type: Array, attribute: false},
        };
    }

    cloneAnnotationRows(rows = []) {
        return rows.map((row) => ({...row}));
    }

    setAnnotationRows(rows) {
        this.annotationRows = rows ? this.cloneAnnotationRows(rows) : [];
        if (this.annotationRows.length === 0) {
            this.isTextHidden = false;
        }
    }

    /**
     * Deletes all fields and restore introduction text
     */
    deleteAll() {
        this.annotationRows = [];
        this.isTextHidden = false;
    }

    validateValues(quiet = false) {
        const i18n = this._i18n;
        for (let annotation of this.annotationRows) {
            const annotationTypeData = utils.getAnnotationTypes(annotation['annotationType']);
            if (!annotation.isSelected) continue;

            if (annotation['value'] === null || annotation['value'] === '') {
                if (!quiet) {
                    send({
                        summary: i18n.t('annotation-view.empty-annotation-title', {
                            annotationType: annotationTypeData.name[this.lang],
                        }),
                        body: i18n.t('annotation-view.empty-annotation-message'),
                        type: 'danger',
                        targetNotificationId: 'dbp-modal-notification-annotation',
                        timeout: 0,
                    });
                }
                return false;
            }

            const pattern = new RegExp('[A-Za-z0-9ÄäÖöÜüß*\\/?! &@\\(\\)=+_\\-\\:]*');
            let matchResult = annotation['value'].match(pattern);

            if (
                matchResult[0] === undefined ||
                annotation['value'].length !== matchResult[0].length
            ) {
                if (!quiet) {
                    send({
                        summary: i18n.t('annotation-view.invalid-annotation-text-title'),
                        body: i18n.t('annotation-view.invalid-annotation-text-message'),
                        type: 'danger',
                        targetNotificationId: 'dbp-modal-notification-annotation',
                        timeout: 0,
                    });
                }
                return false;
            }
        }
        return true;
    }

    /**
     * Stores information to document
     */
    saveAll() {
        this.annotationRows = this.annotationRows.filter(
            (row) => row.isSelected && row.value !== '',
        );

        if (!this.validateValues()) {
            return;
        }

        const data = {
            key: this.key,
            annotationRows: this.cloneAnnotationRows(this.annotationRows),
        };
        const event = new CustomEvent('dbp-pdf-annotations-save', {
            detail: data,
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(event);

        if (this.annotationRows.length === 0) {
            this.isTextHidden = false;
        }
    }

    /**
     * Remove an annotation of a file on the queue
     *
     * @param id
     */
    removeAnnotation(id) {
        if (this.annotationRows && this.annotationRows[id]) {
            const annotationIndex = Number(id);
            this.annotationRows = this.annotationRows.filter(
                (_, index) => index !== annotationIndex,
            );

            if (this.annotationRows.length === 0) {
                this.isTextHidden = false;
                // this.sendCancelEvent();
            }
            const count = this.annotationRows.filter((row) => row.isSelected).length;
            if (count <= 1) {
                this.enableRemoveAll = false;
            }
        }
    }

    enableRemoveAllButton() {
        const count = this.annotationRows.filter((row) => row.isSelected).length;
        if (count > 0) {
            this.enableRemoveAll = true;
        }
    }

    sendCancelEvent() {
        const event = new CustomEvent('dbp-pdf-annotations-cancel', {
            detail: {},
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(event);
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getGeneralCSS()}
            ${commonStyles.getButtonCSS()}

            .inner-grid, .annotation-fields {
                display: flex;
                flex-flow: row wrap;
                justify-content: space-between;
                align-items: center;
                container: annotation-from / inline-size;
                gap: 10px;
                padding-bottom: 10px;
            }

            .input-button-wrapper {
                display: flex;
                flex-grow: 1;
            }

            .annotation-text-input {
                flex-grow: 1;
            }

            #additional-select {
                background-size: 13px auto;
                background-position-x: calc(100% - 0.4rem);
                padding-right: 1.3rem;
                padding-left: 0.5em;
                height: 33px;
            }

            .add-annotation-wrapper {
                display: flex;
                justify-content: space-between;
            }
            .annotations-visible {
                display: contents;
            }
            .annotations-hidden {
                display: none;
            }

            .btn-visible {
                display: block;
            }

            .btn-hidden {
                display: none;
            }

            @container annotation-form (width < 450px) {
                .inner-grid label {
                    flex-basis: 100%;
                }
            }

            .annotation-block {
                display: grid;
                row-gap: 0.3em;
                align-items: center;
                margin-left: 2px;
                margin-right: 2px;
            }

            .form-fields {
                display: flex;
                flex-direction: column;
                gap: 1em;
            }

            .form-description.hidden + .form-fields {
                border-top: 2px solid var(--dbp-content);
                padding-top: 1.5em;
            }

            .annotation-block .inner-grid label {
                min-width: 180px;
            }

            .annotation-block .annotation-text-input {
                flex-grow: 1;
                border: var(--dbp-border);
                border-right: 0 none;
                border-color: var(--dbp-muted);
                height: 30px;
                margin: 0;
                padding-left: 8px;
                font-weight: 300;
                color: inherit;
                line-height: 100%;
            }

            .annotation-text-input {
                height: 27px;
            }

            .annotation-block button.annotation-close-button {
                border: var(--dbp-border);
            }

            .annotation-block button.annotation-close-button:hover:enabled {
                border: var(--dbp-border);
            }

            .annotation-form {
                display: grid;
                row-gap: 1em;
                cursor: default;
            }

            .action-buttons-wrapper {
                display: flex;
                gap: 0.5em;
                justify-content: flex-end;
            }

            .form-wrapper {
                position: relative;
                padding: 0.5em;
                padding-bottom: 0.8em;
                border-top-width: 0;
            }

            .pdf-main-container {
                gap: 20px;
                display: grid;
            }
            .pdf-meta {
                border-bottom-width: 0;
                border-top-width: 0;
            }

            .pdf-meta option {
                color: var(--dbp-content);
                background-color: var(--dbp-background);
            }

            .btn-wrapper {
                display: flex;
                justify-content: space-between;
            }
            .nav-buttons {
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                flex-grow: 1;
                flex-wrap: wrap;
                gap: 1em;
            }

            .buttons {
                align-self: center;
                white-space: nowrap;
            }

            .nav-buttons > * {
                margin: 2px;
            }

            .add-elements .button {
                height: 28px;
            }

            .add-elements select {
                background-size: 13px;
                background-position-x: calc(100% - 0.4rem);
                padding-right: 1.3rem;
                padding-left: 0.5em;
                height: 33px;
            }

            /* Handling for small displays (like mobile devices) */
            @media only screen and (orientation: portrait) and (max-width: 768px) {
                .nav-buttons {
                    flex-direction: column;
                }

                .add-elements {
                    display: grid;
                    grid-template-columns: auto 42px;
                    grid-template-rows: auto;
                    column-gap: 3px;
                }
            }
        `;
    }

    addNewAnnotation() {
        if (!this.annotationRows) {
            this.annotationRows = [];
        }
        this.annotationRows = [
            ...this.annotationRows,
            {annotationType: 'default', value: '', isSelected: false},
        ];
    }

    /**
     * Update an annotation of a file on the queue
     *
     * @param id
     * @param annotationKey
     * @param value
     */
    updateAnnotation(id, annotationKey, value) {
        if (this.annotationRows && this.annotationRows[id]) {
            this.annotationRows[id][annotationKey] = value;
        }
    }

    /**
     * Returns the list of files of annotations of a queued file
     *
     * @returns {Array} Array of html templates
     */
    addNewAnnotationsHTML() {
        const i18n = this._i18n;
        const annotations = this.annotationRows || [];
        const ids = Object.keys(annotations);
        let results = [];

        ids.forEach((id) => {
            const data = this.annotationRows[id] || [];
            const annotationTypeData = utils.getAnnotationTypes(data.annotationType);
            const count = this.annotationRows.filter((row) => row.isSelected).length;
            if (count > 0) {
                this.enableRemoveAll = true;
            }

            results.push(html`
                <div class="annotation-fields">
                    <select
                        id="additional-select"
                        class="additional-select"
                        @change="${(e) => {
                            this.updateAnnotation(id, 'isSelected', true);
                            this.updateAnnotation(id, 'annotationType', e.target.value);
                            this.annotationRows = [...this.annotationRows];
                        }}">
                        ${utils.getAnnotationTypeSelectOptionsHtml('', this.lang)}
                        <option value="" disabled selected>
                            ${i18n.t('annotation-view.insert-field')}
                        </option>
                    </select>
                    <div class="${data.isSelected ? 'annotations-visible' : 'annotations-hidden'}">
                        <input
                            type="text"
                            .value="${data.value}"
                            class="input annotation-text-input "
                            pattern="[A-Za-z0-9ÄäÖöÜüß*\\/! &@\\(\\)=+_\\-\\:]*"
                            placeholder="${i18n.t(annotationTypeData.placeholderTextId)}"
                            @change=${(e) => {
                                this.updateAnnotation(id, 'value', e.target.value);
                            }} />
                        <button
                            class="button annotation-close-button is-icon"
                            title="${i18n.t('annotation-view.remove-field')}"
                            aria-label="${i18n.t('annotation-view.remove-field')}"
                            @click="${() => {
                                this.removeAnnotation(id);
                            }}">
                            <dbp-icon name="trash" aria-hidden="true"></dbp-icon>
                        </button>
                    </div>
                </div>
            `);
        });
        return results;
    }

    render() {
        const i18n = this._i18n;
        return html`
            <div id="pdf-main-container" class="pdf-main-container">
                <div id="pdf-meta" class="pdf-meta">
                    <div class="nav-buttons">
                        <div class="add-annotation-wrapper">
                            <button
                                class="button is-primary"
                                title="annotation-button-title"
                                aria-label="annotation-button-title"
                                @click="${() => {
                                    this.addNewAnnotation();
                                }}">
                                <dbp-icon name="plus" aria-hidden="true"></dbp-icon>
                                ${i18n.t('annotation-button-title')}
                            </button>
                            <button
                                class="button clear-all-button ${this.enableRemoveAll
                                    ? 'btn-visible'
                                    : 'btn-hidden'}"
                                title="${i18n.t('annotation-view.delete-all-button-title')}"
                                @click="${() => {
                                    this.deleteAll();
                                    this.enableRemoveAll = !this.enableRemoveAll;
                                }}">
                                <dbp-icon name="trash" aria-hidden="true"></dbp-icon>
                                ${i18n.t('annotation-view.delete-all-button-text')}
                            </button>
                        </div>
                    </div>
                </div>
                <div class="annotation-wrapper">${this.addNewAnnotationsHTML()}</div>

                <div slot="footer" class="modal-footer">
                    <div class="btn-wrapper">
                        <button
                            class="button is-secondary"
                            title="${i18n.t('annotation-view.close-button-title')}"
                            @click="${() => this.sendCancelEvent()}">
                            <dbp-icon name="close" aria-hidden="true"></dbp-icon>
                            ${i18n.t('button-close-text')}
                        </button>
                        <button
                            class="button is-primary save-all-button"
                            ?disabled="${!this.annotationRows.some((row) => row.isSelected)}"
                            title="${i18n.t('annotation-view.save-all-button-title')}"
                            @click="${() => {
                                this.saveAll();
                            }}">
                            <dbp-icon name="save" aria-hidden="true"></dbp-icon>
                            ${i18n.t('annotation-view.save-all-button-text')}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}
