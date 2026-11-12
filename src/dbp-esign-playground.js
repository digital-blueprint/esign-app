import {css, html} from 'lit';
import {LangMixin, ScopedElementsMixin} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {createInstance} from './i18n.js';
import {EsignPlaygroundSignature} from './playground/signature.js';
import {EsignPlaygroundProfiles} from './playground/profiles.js';

class EsignPlayground extends LangMixin(ScopedElementsMixin(DBPLitElement), createInstance) {
    constructor() {
        super();
        this.entryPointUrl = '';
        this.auth = null;
    }

    static get properties() {
        return {
            ...super.properties,
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            auth: {type: Object},
        };
    }

    static get scopedElements() {
        return {
            'dbp-esign-playground-signature': EsignPlaygroundSignature,
            'dbp-esign-playground-profiles': EsignPlaygroundProfiles,
        };
    }

    static get styles() {
        return css`
            :host {
                display: block;
            }

            dbp-esign-playground-profiles {
                margin-top: 2rem;
            }
        `;
    }

    render() {
        return html`
            <dbp-esign-playground-signature lang="${this.lang}"></dbp-esign-playground-signature>
            <dbp-esign-playground-profiles
                lang="${this.lang}"
                .auth="${this.auth}"
                .entryPointUrl="${this.entryPointUrl}"></dbp-esign-playground-profiles>
        `;
    }
}

commonUtils.defineCustomElement('dbp-esign-playground', EsignPlayground);
