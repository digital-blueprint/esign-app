import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {AuthMixin} from '@dbp-toolkit/common';

export class BaseLitElement extends AuthMixin(DBPLitElement) {
    constructor() {
        super();
    }

    _(selector) {
        return this.shadowRoot === null
            ? this.querySelector(selector)
            : this.shadowRoot.querySelector(selector);
    }

    get authenticatedUser() {
        if (this.auth === null) {
            throw new Error('Authentication is required');
        }
        return this.auth;
    }

    isLoading() {
        return this.isAuthPending();
    }
}
