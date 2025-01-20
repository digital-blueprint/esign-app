import {createInstance} from './i18n.js';
import {css, html} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {MiniSpinner, Icon} from '@dbp-toolkit/common';
import {ResourceSelect} from '@dbp-toolkit/resource-select';
import {send} from '@dbp-toolkit/common/notification';
import * as commonStyles from '@dbp-toolkit/common/styles';
import * as utils from './utils';

/**
 * PdfAnnotationView web component
 */
export class PdfAnnotationView extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.isTextHidden = false;
        this.isSelected = false;
        this.annotationRows = [];
        this.queuedFilesAnnotationsCount = 0;
        this.key = -1;
    }

    static get scopedElements() {
        return {
            'dbp-mini-spinner': MiniSpinner,
            'dbp-icon': Icon,
            'dbp-resource-select': ResourceSelect,
        };
    }

    /**
     * See: https://lit-element.polymer-project.org/guide/properties#initialize
     */
    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            key: {type: Number},
            isTextHidden: {type: Boolean, attribute: false},
            isSelected: {type: Boolean, attribute: false},
            annotationRows: {type: Array, attribute: false},
            queuedFilesAnnotationsCount: {type: Number, attribute: false},
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

    setAnnotationRows(rows) {
        this.annotationRows = rows ? rows : [];
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
        this.sendCancelEvent();
    }

    sendCancelEvent() {
        console.log('cancel event called');
        const event = new CustomEvent('dbp-pdf-annotations-cancel', {
            detail: {},
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(event);
    }

    validateValues(quiet = false) {
        const i18n = this._i18n;
        for (let annotation of this.annotationRows) {
            const annotationTypeData = utils.getAnnotationTypes(annotation['annotationType']);

            if (annotation['value'] === null || annotation['value'] === '') {
                if (!quiet) {
                    send({
                        summary: i18n.t('annotation-view.empty-annotation-title', {
                            annotationType: annotationTypeData.name[this.lang],
                        }),
                        body: i18n.t('annotation-view.empty-annotation-message'),
                        type: 'danger',
                        targetNotificationId: 'dbp-modal-notification-annotation',
                        timeout: 5,
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
                        timeout: 5,
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
        if (!this.validateValues()) {
            return;
        }

        const data = {
            key: this.key,
            annotationRows: this.annotationRows,
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
     * Add an annotation to a file on the queue
     *
     */
    addAnnotation() {
        if (!this.annotationRows) {
            this.annotationRows = [];
            this.queuedFilesAnnotationsCount = 0;
        }

        let e = /** @type {HTMLSelectElement} */ (this._('#additional-select'));
        let type = e?.options[e?.selectedIndex]?.value;
        this.annotationRows.push({annotationType: type, value: ''});

        // we just need this so the UI will update
        this.queuedFilesAnnotationsCount++;

        if (!this.isTextHidden) {
            this.isTextHidden = true;
        }
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
     * Remove an annotation of a file on the queue
     *
     * @param id
     */
    removeAnnotation(id) {
        if (this.annotationRows && this.annotationRows[id]) {
            this.annotationRows.splice(id, 1);

            if (this.annotationRows.length === 0) {
                this.isTextHidden = false;
                // this.sendCancelEvent();
            }

            // we just need this so the UI will update
            this.queuedFilesAnnotationsCount--;
        }
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getGeneralCSS()}
            ${commonStyles.getButtonCSS()}

            .inner-grid {
                display: flex;
                flex-flow: row wrap;
                justify-content: space-between;
                align-items: center;
                container: annotation-from /inline-size;
            }

            .input-button-wrapper {
                display: flex;
                flex-grow: 1;
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
                gap: .5em;
            }

            .form-wrapper {
                position: relative;
                padding: 0.5em;
                padding-bottom: 0.8em;
                border-top-width: 0;
            }

            .pdf-meta {
                padding: 0.5em;
                border-bottom-width: 0;
                border-top-width: 0;
                padding-bottom: 1em;
            }

           .pdf-meta option {
                color: var(--dbp-content);
                background-color: var(--dbp-background);
            }

            .nav-buttons {
                display: flex;
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

    /**
     * Returns the list of files of annotations of a queued file
     *
     * @returns {*[]} Array of html templates
     */
    getAnnotationsHtml() {
        const i18n = this._i18n;
        const annotations = this.annotationRows || [];
        const ids = Object.keys(annotations);
        let results = [];

        ids.forEach((id) => {
            const data = this.annotationRows[id] || [];
            const annotationTypeData = utils.getAnnotationTypes(data.annotationType);
            const name = annotationTypeData.name[this.lang];

            results.push(html`
                <div
                    class="${classMap({
                        'annotation-block': true,
                    })}">
                    <div class="inner-grid">
                        <label><strong>${name}</strong></label>
                        <div class="input-button-wrapper">
                            <input
                                type="text"
                                .value="${data.value}"
                                class="input annotation-text-input"
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
                </div>
            `);
        });

        return results;
    }

    render() {
        const i18n = this._i18n;
        return html`
            <div id="pdf-main-container">
                <div id="pdf-meta" class="pdf-meta">
                    <div class="nav-buttons">
                        <div class="add-elements">
                            <select id="additional-select" @change="${() => {
                                this.isSelected = true;
                            }}">
                                ${utils.getAnnotationTypeSelectOptionsHtml('', this.lang)}
                                <option value="" disabled selected>
                                    ${i18n.t('annotation-view.insert-field')}
                                </option>
                            </select>
                            <button class="button insert-button"
                                    title="${i18n.t('annotation-view.insert-field')}"
                                    aria-label="${i18n.t('annotation-view.insert-field')}"
                                    @click="${() => {
                                        this.addAnnotation();
                                    }}"
                                    ?disabled="${!this.isSelected}">
                                <dbp-icon name="plus" aria-hidden="true"></dbp-icon></button>
                            </button>
                        </div>

                        <div class="action-buttons-wrapper">
                                <button class="button clear-all-button ${classMap({
                                        hidden: !this.isTextHidden && this.annotationRows.length === 0,
                                    })}"
                                    title="${i18n.t('annotation-view.delete-all-button-title')}"
                                    @click="${() => {
                                        this.deleteAll();
                                    }}"
                                    ?disabled="${this.annotationRows.length === 0}">
                                    ${i18n.t('annotation-view.delete-all-button-text')}
                                </button>
                            <button class="button is-primary save-all-button"
                                title="${i18n.t('annotation-view.save-all-button-title')}"
                                @click="${() => {
                                    this.saveAll();
                                }}"
                                ?disabled="${this.annotationRows.length === 0}">
                                ${i18n.t('annotation-view.save-all-button-text')}
                            </button>
                            </div>
                    </div>
                </div>
                <div class="form-wrapper">
                    <div class="annotation-form">
                        <div class="form-description ${classMap({
                                hidden: this.isTextHidden || this.annotationRows.length > 0,
                            })}">
                            <p>${i18n.t('annotation-view.introduction')}</p>
                        </div>
                        <div class="form-fields">
                            ${this.getAnnotationsHtml()}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}
