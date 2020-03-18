import {createI18nInstance} from './i18n.js';
import {css, html, LitElement} from 'lit-element';
import * as commonUtils from 'vpu-common/utils';
import * as commonStyles from 'vpu-common/styles';
import 'vpu-person-profile';

const i18n = createI18nInstance();

class SignatureWelcome extends LitElement {

    constructor() {
        super();
        this.lang = i18n.language;

    }

    static get properties() {
        return {
            lang: { type: String },
        };
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            if (propName === "lang") {
                i18n.changeLanguage(this.lang);
            }
        });

        super.update(changedProperties);
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS()}
        `;
    }

    render() {
        return html`
            <p>${i18n.t('welcome.headline')}</p>
            <br>
            <p>${i18n.t('welcome.description')}</p>
        `;
    }
}

commonUtils.defineCustomElement('vpu-signature-welcome', SignatureWelcome);
