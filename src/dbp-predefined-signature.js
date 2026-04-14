import {css, html} from 'lit';
import {ScopedElementsMixin} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import * as commonUtils from '@dbp-toolkit/common/utils';

class PredefinedSignature extends ScopedElementsMixin(DBPLitElement) {
    static get styles() {
        return css``;
    }

    render() {
        return html`
            <p>TODO</p>
        `;
    }
}

commonUtils.defineCustomElement('dbp-predefined-signature', PredefinedSignature);
