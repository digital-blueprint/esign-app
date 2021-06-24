import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';

export class BaseLitElement extends DBPLitElement {
    constructor() {
        super();
        this.auth = {};
    }

    static get properties() {
        return {
            ...super.properties,
            auth: { type: Object },
        };
    }

    _(selector) {
        return this.shadowRoot === null ? this.querySelector(selector) : this.shadowRoot.querySelector(selector);
    }

    _hasSignaturePermissions(roleName) {
        return (this.auth.person && Array.isArray(this.auth.person.roles) && this.auth.person.roles.indexOf(roleName) !== -1);
    }

    _updateAuth() {
        this._loginStatus = this.auth['login-status'];
        // Every time isLoggedIn()/isLoading() return something different we request a re-render
        let newLoginState = [this.isLoggedIn(), this.isLoading()];
        if (this._loginState.toString() !== newLoginState.toString()) {
            this.requestUpdate();
        }
        this._loginState = newLoginState;
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case "auth":
                    this._updateAuth();
                    break;
            }
        });

        super.update(changedProperties);
    }

    connectedCallback() {
        super.connectedCallback();

        this._loginStatus = '';
        this._loginState = [];
    }

    isLoggedIn() {
        return (this.auth.person !== undefined && this.auth.person !== null);
    }

    isLoading() {
        if (this._loginStatus === "logged-out")
            return false;
        return (!this.isLoggedIn() && this.auth.token !== undefined);
    }
}
