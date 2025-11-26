import {createInstance} from './i18n.js';
import {css, html} from 'lit';
import {LangMixin, ScopedElementsMixin} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import * as commonUtils from '@dbp-toolkit/common/utils';
import * as commonStyles from '@dbp-toolkit/common/styles';

class SignatureVerification extends LangMixin(ScopedElementsMixin(DBPLitElement), createInstance) {
    static get scopedElements() {
        return {};
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

            .description {
                margin-top: 0;
            }
        `;
    }

    render() {
        const i18n = this._i18n;
        return html`
            <p class="description">${i18n.t('signature-verification-extern.description-text')}</p>
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
