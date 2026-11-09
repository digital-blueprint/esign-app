import {html} from 'lit';
import {LangMixin, ScopedElementsMixin} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {createInstance} from './i18n.js';

class EsignPlayground extends LangMixin(ScopedElementsMixin(DBPLitElement), createInstance) {
    static get scopedElements() {
        return {};
    }

    render() {
        return html``;
    }
}

commonUtils.defineCustomElement('dbp-esign-playground', EsignPlayground);
