import {createI18nInstance} from './i18n.js';
import {css, html} from 'lit-element';
import {classMap} from 'lit-html/directives/class-map.js';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {MiniSpinner, Icon} from '@dbp-toolkit/common';
import {OrganizationSelect} from "@dbp-toolkit/organization-select";
import * as commonStyles from '@dbp-toolkit/common/styles';
import * as utils from './utils';

const i18n = createI18nInstance();

/**
 * AnnotationView web component
 */
export class AnnotationView extends ScopedElementsMixin(DBPLitElement) {
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

    /**
     * Deletes all fields and restore introduction text 
     */
    deleteAll() {
        this.annotationRows = [];
        this.isTextHidden = false;
    }

    sendCancelEvent() {
        const event = new CustomEvent("dbp-pdf-annotations-cancel",
            { "detail": {}, bubbles: true, composed: true });
        this.dispatchEvent(event);
    }

    /**
     * Stores information to document
     */
    saveAll() {
        const data = {
            "key": this.key,
            "annotationRows": this.annotationRows,
        };
        const event = new CustomEvent("dbp-pdf-annotations-save",
            { "detail": data, bubbles: true, composed: true });
        this.dispatchEvent(event);
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

            #org-selector {
                text-overflow: ellipsis;
            }

            div.annotation-block.with-organization select:not(.select) {
                background-size: 4%;
            }

            div.annotation-block.with-organization {
                display: grid;
                grid-template-columns: 140px auto auto 42px; 
                column-gap: .5em;

                align-items: center;

                margin-left: 4px;
                margin-right: 2px;
            }

            div.annotation-block {
                display: grid;
                grid-template-columns: 140px auto 42px; 
                column-gap: .5em;

                align-items: center;

                margin-left: 4px;
                margin-right: 2px;
            }

            .text {
                padding-left: 1em;
                padding-right: 1em;
            }

            #inside-fields {
                display: grid;
                row-gap: .5em;
            }

            .add-elements {
                padding-top: 1em;

                margin-left: 2px;
                margin-right: 2px;

                display: flex;
                justify-content: flex-end;
            }

            .add-elements .button {
                margin-left: .5em;
            }

            select:not(.select) {
                background-size: 8%;
                height: 33px;
            }

            #fields-wrapper {
                position: relative;
                border-color: #000;
                border-width: 1px;
                border-style: solid;
                padding: 0.5em;
                padding-bottom: 1.5em;
                border-top-width: 0;
            }

            #fields-wrapper fields {
                position: absolute;
                top: 0;
                left: 0;
                border: solid 1px black;
                border-top-color: #888;
            }

            #pdf-meta {
                border-color: #000;
                border-width: 1px;
                border-style: solid;
                padding: 0.5em;
                border-bottom-width: 0;
                border-top-width: 0;
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

            if (annotationTypeData.hasOrganization) {
                results.push(html`
                    <div class="annotation-block annotation-block-${this.key}-${id} with-organization">
                        <label>${name}</label>
                        <dbp-organization-select subscribe="lang:lang,entry-point-url:entry-point-url,auth:auth"
                                value="${data.organizationNumber}"
                                @change=${e => { this.updateAnnotation(id, 'organizationNumber', JSON.parse(e.target.getAttribute("data-object")).alternateName); }}></dbp-organization-select>
                        <input type="text" class="input" placeholder="${i18n.t('annotation-view.businessnumber-placeholder')}" @change=${e => { this.updateAnnotation(id, 'value', e.target.value); }}>
                        <button class="button close" 
                            title="${i18n.t('annotation-view.remove-field')}" 
                            @click="${() => { this.removeAnnotation(id); } }">
                            <dbp-icon name="trash"></dbp-icon></button>
                    </div>
                `);
            } else {
                results.push(html`
                    <div class="annotation-block annotation-block-${this.key}-${id}">
                        <label>${name}</label>
                        <input type="text" class="input" placeholder="${i18n.t('annotation-view.intended-use-placeholder')}" @change=${e => { this.updateAnnotation(id, 'value', e.target.value); }}>
                        <button class="button close" 
                            title="${i18n.t('annotation-view.remove-field')}" 
                            @click="${() => { this.removeAnnotation(id); } }">
                            <dbp-icon name="trash"></dbp-icon></button>
                    </div>
                `);
            }
       });

       return results;
   }

    render() {

        return html`

            <div id="pdf-main-container">
                <div id="pdf-meta">
                    <div class="nav-buttons">
                        <button class="button"
                            title="${i18n.t('annotation-view.delete-all-button-title')}"
                            @click="${() => { this.deleteAll(); } }"
                            ?disabled="${ this.annotationRows.length === 0 }">
                            ${i18n.t('annotation-view.delete-all-button-text')}
                        </button>
                        <button class="button is-primary"
                            title="${i18n.t('annotation-view.save-all-button-title')}"
                            @click="${() => { this.saveAll(); } }"
                            ?disabled="${ this.annotationRows.length === 0 }">
                            ${i18n.t('annotation-view.save-all-button-text')}
                        </button>
                    </div>
                </div>
    
                <div id="fields-wrapper">
                    <div id="inside-fields">
                        <div class="text ${classMap({hidden: this.isTextHidden})}">
                            <p>${i18n.t('annotation-view.introduction')}</p>
                        </div>
                        ${this.getAnnotationsHtml()}
                    </div>
                    
                    <div class="add-elements">
                        <select id="additional-select" @change="${() => { this.isSelected = true; } }">
                            ${utils.getAnnotationTypeSelectOptionsHtml('', this.lang)}
                            <option value="" disabled selected>${i18n.t('annotation-view.insert-field')}</option>
                        </select>
                        <button class="button"
                                title="${i18n.t('annotation-view.insert-field')}" 
                                @click="${() => { this.addAnnotation(); } }" 
                                ?disabled="${ !this.isSelected }">
                            <dbp-icon name="plus"></dbp-icon></button>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}
