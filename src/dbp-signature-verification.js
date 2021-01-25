import {createI18nInstance} from './i18n.js';
import {css, html} from 'lit-element';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import DBPSignatureLitElement from "./dbp-signature-lit-element";
import * as commonUtils from '@dbp-toolkit/common/utils';
import * as commonStyles from '@dbp-toolkit/common/styles';

const i18n = createI18nInstance();

class SignatureVerification extends ScopedElementsMixin(DBPSignatureLitElement) {
    constructor() {
        super();
        this.lang = i18n.language;
    }

    static get scopedElements() {
        return { };
    }

    static get properties() {
        return this.getProperties({
            lang: { type: String },
        });
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

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}

            a {
                border-bottom: 1px solid rgba(0,0,0,0.3);
                padding: 0;
            }

            a:hover {
                color: #fff;
                background-color: #000;
            }

            h2:first-child {
                margin-top: 0;
            }

            h2 {
                margin-bottom: 10px;
            }
        `;
    }

    render() {
        return html`
            <h2>${i18n.t('signature-verification-extern.headline')}</h2>
            <p>
                ${i18n.t('signature-verification-extern.description-text')}
            </p>
            <a target="_blank" rel="noopener" href="https://www.signatur.rtr.at/${this.lang}/vd/Pruefung">${i18n.t('signature-verification-extern.link-label')}</a>.
        `;
    }
}

commonUtils.defineCustomElement('dbp-signature-verification', SignatureVerification);
