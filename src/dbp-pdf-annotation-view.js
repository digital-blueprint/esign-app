import {createI18nInstance} from './i18n.js';
import {css, html} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {MiniSpinner, Icon} from '@dbp-toolkit/common';
import {OrganizationSelect} from "@dbp-toolkit/organization-select";
import { send } from '@dbp-toolkit/common/notification';
import * as commonStyles from '@dbp-toolkit/common/styles';
import * as utils from './utils';

const i18n = createI18nInstance();

/**
 * PdfAnnotationView web component
 */
export class PdfAnnotationView extends ScopedElementsMixin(DBPLitElement) {
    constructor() {
        super();
        this.lang = 'de';
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
            'dbp-organization-select': OrganizationSelect,
        };
    }

    /**
     * See: https://lit-element.polymer-project.org/guide/properties#initialize
     */
    static get properties() {
        return {
            ...super.properties,
            lang: { type: String },
            key: { type: Number },
            isTextHidden: { type: Boolean, attribute: false },
            isSelected: { type: Boolean, attribute: false },
            annotationRows: { type: Array, attribute: false },
            queuedFilesAnnotationsCount: { type: Number, attribute: false },
        };
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case "lang":
                    i18n.changeLanguage(this.lang);
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
        const event = new CustomEvent("dbp-pdf-annotations-cancel",
            { "detail": {}, bubbles: true, composed: true });
        this.dispatchEvent(event);
    }

    validateValues() {
        
        for (let annotation of this.annotationRows) {
            const annotationTypeData = utils.getAnnotationTypes(annotation['annotationType']);

            if (annotationTypeData['hasOrganization']) {
                let organization = annotation.organizationValue;

                if (typeof organization === 'undefined' || organization === null || organization === '') {
                    send({
                        "summary": i18n.t('annotation-view.empty-organization-title'),
                        "body": i18n.t('annotation-view.empty-organization-message'),
                        "type": "danger",
                        "timeout": 5,
                    });
                    return false;
                }
            }

            if (annotation['value'] === null || annotation['value'] === '') {
                send({
                    "summary": i18n.t('annotation-view.empty-annotation-title', {annotationType: annotationTypeData.name[this.lang]}),
                    "body": i18n.t('annotation-view.empty-annotation-message'),
                    "type": "danger",
                    "timeout": 5,
                });
                return false;
            }

            const pattern = new RegExp('[A-Za-z0-9ÄäÖöÜüß*\\/?! &@()=+_-]*');
            let matchResult = annotation['value'].match(pattern);

            if (matchResult[0] === undefined || annotation['value'].length !== matchResult[0].length) {
                send({
                    "summary": i18n.t('annotation-view.invalid-annotation-text-title'),
                    "body": i18n.t('annotation-view.invalid-annotation-text-message'),
                    "type": "danger",
                    "timeout": 5,
                });
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
            "key": this.key,
            "annotationRows": this.annotationRows,
        };
        const event = new CustomEvent("dbp-pdf-annotations-save",
            { "detail": data, bubbles: true, composed: true });
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

        let e = this._('#additional-select');
        let type = e?.options[e?.selectedIndex]?.value;
        this.annotationRows.push({'annotationType': type, 'value': ''});

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
            // delete this.annotationRows[id]; //length of array doesn't change
            this.annotationRows.splice(id, 1);

            if(this.annotationRows.length === 0) {
                this.isTextHidden = false;
                this.sendCancelEvent();
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

            div.inner-grid {
                display: flex;
                flex-flow: row wrap;
                justify-content: space-between;
                align-items: center;
            }

            div.annotation-block {
                display: grid;
                row-gap: .3em;

                align-items: center;
                
                margin-left: 2px;
                margin-right: 2px;
            }

            .text {
                padding-left: 1em;
                padding-right: 1em;
            }

            .border {
                border-top: 1px solid #888;
                padding-bottom: .5em;
            }
            .border-wrapper {
                border: 1px solid black;
                border-bottom-width: 0;
                border-top-width: 0;

                padding-left: 3px;
                padding-right: 3px;
            }

            #inside-fields {
                display: grid;
                row-gap: 1em;
            }

            .delete-elements {
                padding-top: 1em;

                margin-left: 2px;
                margin-right: 2px;

                display: flex;
                justify-content: flex-end;
            }

            .delete-elements .button {
                margin-left: .5em;
            }

            select:not(.select) {
                background-size: 13px;
                background-position-x: calc(100% - 0.4rem);
                padding-right: 1.3rem;
                height: 33px;
            }

            #fields-wrapper {
                position: relative;
                border-color: #000;
                border-width: 1px;
                border-style: solid;
                padding: 0.5em;
                padding-bottom: 0.8em;

                border-top-width: 0;
            }

            #pdf-meta {
                border-color: #000;
                border-width: 1px;
                border-style: solid;
                padding: 0.5em;
                border-bottom-width: 0;
                border-top-width: 0;

                padding-bottom: 1em;
            }

            .input {
                padding-left: 8px;
                font-weight: 300;
                color: inherit;
                border: 1px solid #aaa;
                line-height: 100%;
                height: 28px;
                width: 100%;
            }

            .nav-buttons {
                display: flex;
                justify-content: space-between;
                flex-grow: 1;
                flex-wrap: wrap;
            }

            .buttons {
                align-self: center;
                white-space: nowrap;
            }

            .nav-buttons > * {
                margin: 2px;
            }

            /* Handling for small displays (like mobile devices) */
            @media (max-width: 680px) {
                .nav-buttons {
                    flex-direction: column;
                }

                .add-elements {
                    display: grid;
                    grid-template-columns: auto 42px;
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
       const annotations = this.annotationRows || [];
       const ids = Object.keys(annotations);
       let results = [];

       ids.forEach((id) => {
            const data = this.annotationRows[id] || [];
            const annotationTypeData = utils.getAnnotationTypes(data.annotationType);
            const name = annotationTypeData.name[this.lang];

            results.push(html`
                <div class="${classMap({'with-organization': annotationTypeData.hasOrganization, 'annotation-block': true})}">
                    <div class="inner-grid">
                        <label><strong>${name}</strong></label>
                        <button class="button close" 
                            title="${i18n.t('annotation-view.remove-field')}" 
                            @click="${() => { this.removeAnnotation(id); } }">
                            <dbp-icon name="trash"></dbp-icon></button>
                    </div>

                    <dbp-organization-select subscribe="lang:lang,entry-point-url:entry-point-url,auth:auth"
                                            class="${classMap({hidden: !annotationTypeData.hasOrganization})}"
                            value="${data.organizationValue}"
                            @change=${e => {
                                this.updateAnnotation(id, 'organizationValue', e.target.value);
                                this.updateAnnotation(id, 'organizationNumber', JSON.parse(e.target.getAttribute("data-object")).alternateName);
                            }}></dbp-organization-select>

                    <input type="text" .value="${data.value}" class="input" pattern="[A-Za-z0-9ÄäÖöÜüß\*\\/! &@()=+_-]*" 
                            placeholder="${annotationTypeData.hasOrganization ? i18n.t('annotation-view.businessnumber-placeholder') : i18n.t('annotation-view.intended-use-placeholder')}" 
                            @change=${e => { this.updateAnnotation(id, 'value', e.target.value); }}>
                </div>
            `);
       });

       return results;
   }

    render() {
        return html`
            <div id="pdf-main-container">
                <div id="pdf-meta">
                    <div class="nav-buttons">
                        
                        <div class="add-elements">
                            <select id="additional-select" @change="${() => { this.isSelected = true; } }">
                                ${utils.getAnnotationTypeSelectOptionsHtml('', this.lang)}
                                <option value="" disabled selected>${i18n.t('annotation-view.insert-field')}</option>
                            </select>
                            <button class="button"
                                    title="${i18n.t('annotation-view.insert-field')}" 
                                    @click="${() => { this.addAnnotation(); } }" 
                                    ?disabled="${ !this.isSelected }">
                                <dbp-icon name="checkmark-circle"></dbp-icon></button>
                            </button>
                        </div>

                        <button class="button is-primary"
                            title="${i18n.t('annotation-view.save-all-button-title')}"
                            @click="${() => { this.saveAll(); } }"
                            ?disabled="${ this.annotationRows.length === 0 }">
                            ${i18n.t('annotation-view.save-all-button-text')}
                        </button>
                    </div>
                </div>
                <div class="border-wrapper">
                    <div class="border"></div>
                </div>
                <div id="fields-wrapper">
                    <div id="inside-fields">
                        <div class="text ${classMap({hidden: this.isTextHidden || this.annotationRows.length > 0})}">
                            <p>${i18n.t('annotation-view.introduction')}</p>
                        </div>
                        ${this.getAnnotationsHtml()}
                    </div>
                    <div class="delete-elements">
                        <button class="button ${classMap({hidden: !this.isTextHidden && this.annotationRows.length === 0})}"
                                title="${i18n.t('annotation-view.delete-all-button-title')}"
                                @click="${() => { this.deleteAll(); } }"
                                ?disabled="${ this.annotationRows.length === 0 }">
                                ${i18n.t('annotation-view.delete-all-button-text')}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}
