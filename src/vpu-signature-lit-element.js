import {LitElement} from "lit-element";
import * as events from 'vpu-common/events.js';

export default class VPUSignatureLitElement extends LitElement {

    _(selector) {
        return this.shadowRoot === null ? this.querySelector(selector) : this.shadowRoot.querySelector(selector);
    }

    _hasSignaturePermissions(roleName) {
        return (window.VPUPerson && Array.isArray(window.VPUPerson.roles) && window.VPUPerson.roles.indexOf(roleName) !== -1);
    }

    _updateAuth() {
        // Every time isLoggedIn()/isLoading() return something different we request a re-render
        let newLoginState = [this.isLoggedIn(), this.isLoading()];
        if (this._loginState.toString() !== newLoginState.toString()) {
            this.requestUpdate();
        }
        this._loginState = newLoginState;
    }

    connectedCallback() {
        super.connectedCallback();

        this._loginState = [];
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

    isLoading() {
        return (!this.isLoggedIn() && window.VPUAuthToken !== undefined);
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
