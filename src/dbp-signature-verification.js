import {createInstance} from './i18n.js';
import {css, html} from 'lit';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import DBPSignatureLitElement from './dbp-signature-lit-element';
import * as commonUtils from '@dbp-toolkit/common/utils';
import * as commonStyles from '@dbp-toolkit/common/styles';
import metadata from './dbp-signature-verification.metadata.json';
import {Activity} from './activity.js';

class SignatureVerification extends ScopedElementsMixin(DBPSignatureLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
    }

    static get scopedElements() {
        return {};
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
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
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getLinkCss()}
            
            a {
                border-bottom: var(--dbp-border);
                border-color: var(--dbp-content);
                padding: 0;
            }

            h2:first-child {
                margin-top: 0;
                margin-bottom: 0px;
            }

            .subheadline {
                font-style: italic;
                padding-left: 2em;
                margin-top: -1px;
                /*line-height: 1.8;*/
                margin-bottom: 1.2em;
            }
        `;
    }

    render() {
        const i18n = this._i18n;
        const activity = new Activity(metadata);
        return html`
            <h2>${activity.getName(this.lang)}</h2>
            <p class="subheadline">${activity.getDescription(this.lang)}</p>
            <p>${i18n.t('signature-verification-extern.description-text')}</p>
            <a
                target="_blank"
                rel="noopener"
                class="link"
                href="https://www.signaturpruefung.gv.at">
                ${i18n.t('signature-verification-extern.link-label')}
            </a>
            <p>${i18n.t('signature-verification-extern.adobe-reader-text')}</p>
            <slot name="additional-information"></slot>
        `;
    }
}

commonUtils.defineCustomElement('dbp-signature-verification', SignatureVerification);
