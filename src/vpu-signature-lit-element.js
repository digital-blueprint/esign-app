import {LitElement} from "lit-element";
import * as events from 'vpu-common/events.js';

export default class VPUSignatureLitElement extends LitElement {

    _(selector) {
        return this.shadowRoot === null ? this.querySelector(selector) : this.shadowRoot.querySelector(selector);
    }

    hasSignaturePermissions() {
        // TODO: Roles need to be discussed
        // return (window.VPUPerson && Array.isArray(window.VPUPerson.roles) && window.VPUPerson.roles.indexOf('ROLE_F_BIB_F') !== -1);
        return window.VPUPerson && Array.isArray(window.VPUPerson.roles);
    }

    _updateAuth() {
        if (this.isLoggedIn() && !this._loginCalled) {
            this._loginCalled = true;
            this.loginCallback();
        }
    }

    connectedCallback() {
        super.connectedCallback();

        this._loginCalled = false;
        this._subscriber = new events.EventSubscriber('vpu-auth-update', 'vpu-auth-update-request');
        this._updateAuth = this._updateAuth.bind(this);
        this._subscriber.subscribe(this._updateAuth);
    }

    disconnectedCallback() {
        this._subscriber.unsubscribe(this._updateAuth);
        delete this._subscriber;

        super.disconnectedCallback();
    }

    isLoggedIn() {
        return (window.VPUPerson !== undefined && window.VPUPerson !== null);
    }

    loginCallback() {
        // Implement in subclass
        this.requestUpdate();
    }

    getOrganization() {
        const organizationSelect = this._("vpu-knowledge-base-organization-select");

        if (organizationSelect) {
            const objectText = organizationSelect.getAttribute("data-object");

            if (objectText !== null) {
                return JSON.parse(objectText);
            }
        }

        return null;
    }

    getOrganizationCode() {
        const organization = this.getOrganization();

        return organization !== null ? organization.alternateName : "";
    }
}
