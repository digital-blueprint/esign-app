import {createI18nInstance} from '../i18n.js';
import {html, css} from 'lit-element';
import VPULitElement from 'vpu-common/vpu-lit-element'
import 'vpu-language-select';
import 'vpu-common/vpu-button.js';
import 'vpu-auth';
import 'vpu-notification';
import * as commonUtils from 'vpu-common/utils';
import * as commonStyles from 'vpu-common/styles';
import buildinfo from 'consts:buildinfo';
import {classMap} from 'lit-html/directives/class-map.js';
// import * as errorreport from 'vpu-common/errorreport';
import {Router} from './router.js';
import * as events from 'vpu-common/events.js';
import './build-info.js';
import './tugraz-logo.js';
import {send as notify} from 'vpu-notification';
import environment from 'consts:environment';

// errorreport.init({release: 'vpi-signature-app@' + buildinfo.info});


const i18n = createI18nInstance();

/**
 * In case the application gets updated future dynamic imports might fail.
 * This sends a notification suggesting the user to reload the page.
 *
 * uage: importNotify(import('<path>'));
 *
 * @param {Promise} promise
 */
const importNotify = async (promise) => {
    try {
        return await promise;
    } catch (error) {
        console.log(error);
        notify({
            "body": i18n.t('page-updated-needs-reload'),
            "type": "info",
            "icon": "warning"
        });
        throw error;
    }
};


class VPUApp extends VPULitElement {
    constructor() {
        super();
        this.lang = i18n.language;
        this.activeView = '';
        this.entryPointUrl = commonUtils.getAPiUrl();
        this.subtitle = '';
        this.description = '';
        this.routes = [];
        this.metadata = {};
        this.topic = {};
        this.basePath = '';

        this._updateAuth = this._updateAuth.bind(this);
        this._loginStatus = 'unknown';
        this._subscriber = new events.EventSubscriber('vpu-auth-update', 'vpu-auth-update-request');

        this._attrObserver = new MutationObserver(this.onAttributeObserved);
    }

    onAttributeObserved(mutationsList, observer) {
        for(let mutation of mutationsList) {
            if (mutation.type === 'attributes') {
                const key = mutation.attributeName;
                const value = mutation.target.getAttribute(key);
                sessionStorage.setItem('vpu-attr-' + key, value);
            }
        }
    }

    /**
     * Fetches the metadata of the components we want to use in the menu, dynamically imports the js modules for them,
     * then triggers a rebuilding of the menu and resolves the current route
     *
     * @param {string} topicURL The topic metadata URL or relative path to load things from
     */
    async fetchMetadata(topicURL) {
        const metadata = {};
        const routes = [];

        const result = await (await fetch(topicURL, {
            headers: {'Content-Type': 'application/json'}
        })).json();

        this.topic = result;

        const fetchOne = async (url) => {
              const result = await fetch(url, {
                headers: {'Content-Type': 'application/json'}
            });
            if (!result.ok)
                throw result;

            const jsondata = await result.json();
            if (jsondata["element"] === undefined)
                throw new Error("no element defined in metadata");

            return jsondata;
        };

        let promises = [];
        for (const activity of result.activities) {
            const actURL = new URL(activity.path, new URL(topicURL, window.location).href).href;
            promises.push([activity.visible === undefined || activity.visible, actURL, fetchOne(actURL)]);
        }

        for (const [visible, actURL, p] of promises) {
            try {
                const activity = await p;
                activity.visible = visible;
                // Resolve module_src relative to the location of the json file
                activity.module_src = new URL(activity.module_src, actURL).href;
                if (activity.routing_name === 'order-list' && environment === 'production') {
                    console.warn('NOTE: order-list disabled in production!');
                    continue;
                }
                metadata[activity.routing_name] = activity;
                routes.push(activity.routing_name);
            } catch (error) {
                console.log(error);
            }
        }
        // this also triggers a rebuilding of the menu
        this.metadata = metadata;
        this.routes = routes;

        // Switch to the first route if none is selected
        if (!this.activeView)
            this.switchComponent(routes[0]);
        else
            this.switchComponent(this.activeView);

    }

    initRouter() {
        const routes = [
            {
                path: '',
                action: (context) => {
                    return {
                        lang: this.lang,
                        component: '',
                    };
                }
            },
            {
                path: '/:lang',
                children: [
                    {
                        path: '',
                        action: (context, params) => {
                            return {
                                lang: params.lang,
                                component: '',
                            };
                        }
                    },
                    {
                        name: 'mainRoute',
                        path: '/:component',
                        action: (context, params) => {
                            // remove the additional parameters added by Keycloak
                            let componentTag = params.component.toLowerCase().replace(/&.+/,"");
                            return {
                                lang: params.lang,
                                component: componentTag,
                            };
                        },
                    },
                ],
            },
        ];

        this.router = new Router(routes, {
            routeName: 'mainRoute',
            getState: () => {
                return {
                    component: this.activeView,
                    lang: this.lang,
                };
            },
            setState: (state) => {
                this.updateLangIfChanged(state.lang);
                this.switchComponent(state.component);
            }
        }, {
            baseUrl: new URL(this.basePath, window.location).pathname.replace(/\/$/, ''),
        });

        this.router.setStateFromCurrentLocation();
    }

    static get properties() {
        return {
            lang: { type: String, reflect: true },
            src: { type: String },
            basePath: { type: String, attribute: 'base-path' },
            activeView: { type: String, attribute: false},
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            metadata: { type: Object, attribute: false },
            topic: { type: Object, attribute: false },
            subtitle: { type: String, attribute: false },
            description: { type: String, attribute: false },
            _loginStatus: { type: Boolean, attribute: false },
        };
    }

    _updateAuth(login) {
        if (login.status != this._loginStatus) {
            console.log('Login status: ' + login.status);
        }

        this._loginStatus = login.status;

        // Clear the session storage when the user logs out
        if (this._loginStatus === 'logging-out') {
            sessionStorage.clear();
        }
    }

    connectedCallback() {
        super.connectedCallback();

        if (this.src)
            this.fetchMetadata(this.src);
        this.initRouter();

        // listen to the vpu-auth-profile event to switch to the person profile
        window.addEventListener("vpu-auth-profile", () => {
            this.switchComponent('person-profile');
        });

        this._subscriber.subscribe(this._updateAuth);
    }

    disconnectedCallback() {
        this._subscriber.unsubscribe(this._updateAuth);
        super.disconnectedCallback();
    }

    /**
     * Switches language if another language is requested
     *
     * @param {string} lang
     */
    updateLangIfChanged(lang) {
        if (this.lang !== lang) {
            this.lang = lang;
            this.router.update();

            const event = new CustomEvent("vpu-language-changed", {
                bubbles: true,
                detail: {'lang': lang}
            });

            this.dispatchEvent(event);
        }
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            if (propName === "lang") {
                // For screen readers
                document.documentElement.setAttribute("lang", this.lang);
                i18n.changeLanguage(this.lang);
            }
        });

        super.update(changedProperties);
    }

    onMenuItemClick(e) {
        e.preventDefault();
        const link = e.composedPath()[0];
        const location = link.getAttribute('href');
        this.router.updateFromPathname(location);
    }

    onLanguageChanged(e) {
        const newLang = e.detail.lang;
        const changed = (this.lang !== newLang);
        this.lang = newLang;
        if (changed) {
            this.router.update();
            this.subtitle = this.activeMetaDataText("short_name");
            this.description = this.activeMetaDataText("description");
        }
    }

    switchComponent(componentTag) {
        const changed = (componentTag !== this.activeView);
        this.activeView = componentTag;
        if (changed)
            this.router.update();
        const metadata = this.metadata[componentTag];

        if (metadata === undefined) {
            return;
        }

        importNotify(import(metadata.module_src)).then(() => {
            this.updatePageTitle();
            this.subtitle = this.activeMetaDataText("short_name");
            this.description = this.activeMetaDataText("description");
        }).catch((e) => {
            console.error(`Error loading ${ metadata.element }`);
            throw e;
        });
    }

    metaDataText(routingName, key) {
        const metadata = this.metadata[routingName];
        return metadata !== undefined && metadata[key] !== undefined ? metadata[key][this.lang] : '';
    }

    topicMetaDataText(key) {
        return (this.topic[key] !== undefined) ? this.topic[key][this.lang] : '';
    }

    activeMetaDataText(key) {
        return this.metaDataText(this.activeView, key);
    }

    updatePageTitle() {
        document.title = `${this.topicMetaDataText('name')} - ${this.activeMetaDataText("short_name")}`;
    }

    toggleMenu() {
        const menu = this.shadowRoot.querySelector("ul.menu");

        if (menu === null) {
            return;
        }

        menu.classList.toggle('hidden');

        const chevron = this.shadowRoot.querySelector("#menu-chevron-icon");
        if (chevron !== null) {
            chevron.name = menu.classList.contains('hidden') ? 'chevron-down' : 'chevron-up';
        }
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS()}

            .hidden {display: none}

            h1.title {
                margin-bottom: 0;
                font-weight: 300;
            }

            #main {
                display: grid;
                grid-template-columns: minmax(180px, 17%) minmax(0, auto);
                grid-template-rows: min-content min-content 1fr min-content;
                grid-template-areas: "header header" "headline headline" "sidebar main" "footer footer";
                max-width: 1400px;
                margin: auto;
                min-height: 100vh;
            }

            #main-logo {
                padding: 0 50px 0 0;
            }

            header {
                grid-area: header;
                display: grid;
                grid-template-columns: 50% 1px auto;
                grid-template-rows: 60px 60px;
                grid-template-areas: "hd1-left hd1-middle hd1-right" "hd2-left . hd2-right";
                width: 100%;
                max-width: 1060px;
                margin: 0 auto;
            }

            aside { grid-area: sidebar; margin: 30px 15px; }
            #headline { grid-area: headline; margin: 30px; text-align: center; }
            main { grid-area: main; margin: 30px }
            footer { grid-area: footer; margin: 30px; text-align: right; }

            header .hd1-left {
                display: flex;
                flex-direction: column;
                justify-content: center;
                grid-area: hd1-left;
                text-align: right;
                padding-right: 20px;
            }

            header .hd1-middle {
                grid-area: hd1-middle;
                background-color: #000;
                background: linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 85%, rgba(0,0,0,0) 90%);
            }

            header .hd1-right {
                grid-area: hd1-right;
                display: flex;
                flex-direction: column;
                justify-content: center;
                padding-left: 20px;
            }

            header .hd2-left {
                grid-area: hd2-left;
                display: flex;
                flex-direction: column;
                white-space: nowrap;
            }

            header .hd2-left .header {
                margin-left: 50px;
            }

            header .hd2-left a:hover {
                color: #fff;
                background-color: #000;
            }

            header .hd2-right {
                grid-area: hd2-right;
                display: flex;
                flex-direction: column;
                justify-content: center;
                text-align: right;
            }

            header a {
                color: black;
                display: inline;
            }

            aside ul.menu, footer ul.menu {
                list-style: none;
            }

            ul.menu li.close {
                display: none;
            }

            footer {
                display: grid;
                grid-gap: 1em;
                grid-template-columns: 1fr max-content max-content;
            }

            footer a {
                border-bottom: 1px solid rgba(0,0,0,0.3);
                padding: 0;
            }

            footer a:hover {
                color: #fff;
                background-color: #000;
            }

            /* We don't allown inline-svg */
            /*
            footer .int-link-external::after {
                content: "\\00a0\\00a0\\00a0\\00a0";
                background-image: url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3Ardf%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2F02%2F22-rdf-syntax-ns%23%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20height%3D%225.6842mm%22%20width%3D%225.6873mm%22%20version%3D%221.1%22%20xmlns%3Acc%3D%22http%3A%2F%2Fcreativecommons.org%2Fns%23%22%20xmlns%3Adc%3D%22http%3A%2F%2Fpurl.org%2Fdc%2Felements%2F1.1%2F%22%20viewBox%3D%220%200%2020.151879%2020.141083%22%3E%3Cg%20transform%3D%22translate(-258.5%20-425.15)%22%3E%3Cpath%20style%3D%22stroke-linejoin%3Around%3Bstroke%3A%23000%3Bstroke-linecap%3Around%3Bstroke-width%3A1.2%3Bfill%3Anone%22%20d%3D%22m266.7%20429.59h-7.5029v15.002h15.002v-7.4634%22%2F%3E%3Cpath%20style%3D%22stroke-linejoin%3Around%3Bstroke%3A%23000%3Bstroke-linecap%3Around%3Bstroke-width%3A1.2%3Bfill%3Anone%22%20d%3D%22m262.94%20440.86%2015.002-15.002%22%2F%3E%3Cpath%20style%3D%22stroke-linejoin%3Around%3Bstroke%3A%23000%3Bstroke-linecap%3Around%3Bstroke-width%3A1.2%3Bfill%3Anone%22%20d%3D%22m270.44%20425.86h7.499v7.499%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E');
                background-size:contain;
                background-repeat: no-repeat;
                background-position:center center;
                margin: 0 0.5% 0 1.5%;
                font-size:94%;
            } 
            */

            .menu a {
                padding: 0.3em;
                font-weight: 300;
                color: #000;
                display: block;
            }

            .menu a:hover {
                color: #E4154B;
            }

            .menu a.selected {
                color: var(--vpu-light);
                background-color: var(--vpu-dark);
            }

            aside .subtitle {
                display: none;
                color: #4a4a4a;
                font-size: 1.25rem;
                font-weight: 300;
                line-height: 1.25;
                cursor: pointer;
                text-align: center;
            }

            ul.menu.hidden {
                display: block;
            }

            a { transition: background-color 0.15s ease 0s, color 0.15s ease 0s; }

            .description {
                text-align: left;
                margin-bottom: 1rem;
                display: none;
            }

            @media (max-width: 680px) {
                #main {
                    grid-template-columns: minmax(0, auto);
                    grid-template-rows: min-content min-content min-content 1fr min-content;
                    grid-template-areas: "header" "headline" "sidebar" "main" "footer";
                }

                header {
                    grid-template-rows: 40px;
                    grid-template-areas: "hd1-left hd1-middle hd1-right";
                }

                header .hd2-left, header .hd2-right {
                    display: none;
                }

                aside {
                    margin: 0 15px;
                }

                aside h2.subtitle {
                    display: block;
                    margin-bottom: 0.5em;
                }

                aside h2.subtitle:not(:last-child) {
                    margin-bottom: 0.5em;
                }

                aside .menu {
                    border: black 1px solid;
                }

                .menu li {
                    padding: 7px;
                }

                .menu a {
                    padding: 8px;
                }

                ul.menu li.close {
                    display: block;
                    padding: 0 15px 15px 15px;
                    text-align: right;
                    cursor: pointer;
                }

                ul.menu.hidden {
                    display: none;
                }
            }
        `;
    }

    _createActivityElement(activity) {
        // We have to create elements dynamically based on a tag name which isn't possible with lit-html.
        // This means we pass the finished element to lit-html and have to handle element caching and
        // event binding ourselves.

        if (this._lastElm !== undefined) {
            if (this._lastElm.tagName.toLowerCase() == activity.element.toLowerCase()) {
                return this._lastElm;
            } else {
                this._attrObserver.disconnect();
                this._lastElm = undefined;
            }
        }

        const elm = document.createElement(activity.element);

        for(const key of this.topic.attributes) {
            let value = sessionStorage.getItem('vpu-attr-' + key);
            if (value !== null) {
                elm.setAttribute(key, value);
            }
        }

        this._attrObserver.observe(elm, {attributes: true, attributeFilter: this.topic.attributes});

        this._lastElm = elm;
        return elm;
    }

    _renderActivity() {
        const act = this.metadata[this.activeView];
        if (act === undefined)
            return html``;

        const elm =  this._createActivityElement(act);
        elm.setAttribute("entry-point-url", this.entryPointUrl);
        elm.setAttribute("lang", this.lang);
        return elm;
    }

    render() {
        const silentCheckSsoUri = commonUtils.getAssetURL('silent-check-sso.html');

        const getSelectClasses = (name => {
            return classMap({selected: this.activeView === name});
        });

        // We hide the app until we are either fully logged in or logged out
        // At the same time when we hide the main app we show the main slot (e.g. a loading spinner)
        const appHidden = (this._loginStatus == 'unknown' || this._loginStatus == 'logging-in');
        const mainClassMap = classMap({hidden: appHidden});
        const slotClassMap = classMap({hidden: !appHidden});

        // XXX: Safari doesn't like CSS being applied to slots or via HTML,
        // so we have to remove the slow instead of hiding it
        if (!appHidden) {
            this.updateComplete.then(() => {
                const slot = this.shadowRoot.querySelector("slot");
                if (slot) {
                    slot.remove();
                }

                const welcomeActivity = this._("vpu-welcome");

                if (welcomeActivity) {
                    welcomeActivity.setMetaData(this.metadata, i18n.t('welcome.headline'), i18n.t('welcome.description'));
                }
            });
        }

        const prodClassMap = classMap({hidden: buildinfo.env === 'production'});

        this.updatePageTitle();

        // build the menu
        let menuTemplates = [];
        for (let routingName of this.routes) {
            const data = this.metadata[routingName];

            if (data['visible']) {
                menuTemplates.push(html`<li><a @click="${(e) => this.onMenuItemClick(e)}" href="${this.router.getPathname({component: routingName})}" data-nav class="${getSelectClasses(routingName)}" title="${this.metaDataText(routingName, "description")}">${this.metaDataText(routingName, "short_name")}</a></li>`);
            }
        }

        return html`
            <slot class="${slotClassMap}"></slot>
            <div class="${mainClassMap}">
            <div id="main">
                <vpu-notification lang="${this.lang}"></vpu-notification>
                <header>
                    <div class="hd1-left">
                        <vpu-language-select @vpu-language-changed=${this.onLanguageChanged.bind(this)}></vpu-language-select>
                    </div>
                    <div class="hd1-middle">
                    </div>
                    <div class="hd1-right">
                        <vpu-auth lang="${this.lang}" show-profile keycloak-config='{"clientId": "${commonUtils.setting('keyCloakClientId')}", "silentCheckSsoRedirectUri": "${silentCheckSsoUri}"}' load-person try-login></vpu-auth>
                    </div>
                    <div class="hd2-left">
                        <div class="header">
                            <a href="https://www.tugraz.at/" title="TU Graz Home" target="_blank" rel="noopener">TU Graz<br>Graz University of Technology</a>
                        </div>
                    </div>
                    <div class="hd2-right">
                        <vpu-tugraz-logo id="main-logo" lang="${this.lang}"></vpu-tugraz-logo>
                    </div>
                </header>

                <div id="headline">
                    <h1 class="title">${this.topicMetaDataText('name')}</h1>
                </div>

                <aside>
                    <h2 class="subtitle" @click="${this.toggleMenu}">
                        ${this.subtitle}
                        <vpu-icon name="chevron-down" style="color: red" id="menu-chevron-icon"></vpu-icon>
                    </h2>
                    <ul class="menu hidden">
                        ${menuTemplates}
                        <li class="close" @click="${this.toggleMenu}"><vpu-icon name="close" style="color: red"></vpu-icon></li>
                    </ul>
                </aside>

                <main>
                    <p class="description">${this.description}</p>
                    ${ this._renderActivity() }
                </main>

                <footer>
                    <div></div>
                    <a target="_blank" rel="noopener" class="int-link-external" href="https://datenschutz.tugraz.at/erklaerung/">${i18n.t('privacy-policy')}</a>
                    <vpu-build-info class="${prodClassMap}"></vpu-build-info>
                </footer>
            </div>
            </div>
        `;
    }
}

commonUtils.initAssetBaseURL('vpu-app-src');
commonUtils.defineCustomElement('vpu-app', VPUApp);
