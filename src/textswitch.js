import {html, LitElement, css} from 'lit-element';
import * as commonStyles from 'vpu-common/styles';

const BUTTON1 = "button1";
const BUTTON2 = "button2";

/**
 * Attributes:
 *  value1/value2: The values of the buttons
 *  name1/name2: The names of the buttons
 *  name: The active name
 *  disabled: Disable the switch
 * 
 * Events:
 *  change: emitted when the active name changes or the same button is clicked again
 * 
 * Example:
 *  <my-tag name="one" name1="one" name2="two" value1="One", value2="Two"></my-tag>
 */
export class TextSwitch extends LitElement {
    constructor() {
        super();
        this.value1 = "";
        this.value2 = "";
        this.name1 = "";
        this.name2 = "";
        this.name = "";
        this.disabled = false;
        this._active = BUTTON1;
    }

    static get properties() {
        return {
            value1: { type: String },
            value2: { type: String },
            name1: { type: String },
            name2: { type: String },
            name: { type: String, reflect: true },
            disabled: { type: Boolean },
            _active: { type: Boolean },
        };
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getButtonCSS()}

            #button1 {
                border-right-width: 0;
            }

            .active {
                background-color: black !important;
                color: var(--vpu-primary-text-color) !important;
            }
        `;
    }

    update(changedProperties) {
        if (this._active === BUTTON1) {
            this.name = this.name1;
        } else {
            this.name = this.name2;
        }

        changedProperties.forEach((oldValue, propName) => {
            if (propName === "name") {
                if (this[propName] === this.name1) {
                    this._active = BUTTON1;
                }
                if (this[propName] === this.name2) {
                    this._active = BUTTON2;
                }
            } else if (propName === "_active") {
                const event = new CustomEvent("change", {
                    bubbles: true,
                    cancelable: false,
                });
                this.dispatchEvent(event);
            }
        });

        super.update(changedProperties);
    }

    render() {
        const onClick = function (e) {
            let new_id = e.target.id;
            if (new_id === this._active) {
                const event = new CustomEvent("change", {
                    bubbles: true,
                    cancelable: false,
                });
                this.dispatchEvent(event);
            }
            this._active = new_id;
        };

        return html`
            <button @click="${onClick}" class="button ${this._active === BUTTON1 ? `active` : ``}" id="${BUTTON1}" ?disabled="${this.disabled}">
                ${this.value1}
            </button><button @click="${onClick}" class="button ${this._active === BUTTON2 ? `active` : ``}" id="${BUTTON2}" ?disabled="${this.disabled}">
                ${this.value2}
            </button>
        `;
    }
}
