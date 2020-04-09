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
        this.metadata = {};
    }

    static get properties() {
        return {
            lang: { type: String },
            metadata: { type: Object, attribute: false },
        };
    }

    setMetaData(metaData, headline, subHeadline) {
        this.headline = headline || "Welcome";
        this.subHeadline = subHeadline || "";
        this.metadata = metaData;
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

            h2 { margin: inherit; }
            p { margin: 0 0 10px 0; }
            div.item { margin: 30px 0; }
        `;
    }

    render() {
        let itemTemplates = [];

        for (let [key, data] of Object.entries(this.metadata)) {

            if (data['visible'] && (key !== "welcome")) {
                itemTemplates.push(html`
                    <div class="item">
                        <h2>${data.name[this.lang]}</h2>
                        ${data.description[this.lang]}
                    </div>`);
            }
        }

        return html`
            <p>${this.headline}</p>
            <p>${this.subHeadline}</p>
            ${itemTemplates}
        `;
    }
}

commonUtils.defineCustomElement('vpu-welcome', SignatureWelcome);
