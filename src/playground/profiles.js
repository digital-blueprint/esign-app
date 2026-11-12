import {css, html} from 'lit';
import {ref} from 'lit/directives/ref.js';
import {AuthMixin, Button, LangMixin, ScopedElementsMixin, combineURLs} from '@dbp-toolkit/common';
import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {createInstance} from '../i18n.js';
import {EsignApi, ApiError} from '../api.js';
import {ANNOTATION_TYPE_IDS, getAnnotationType} from '../utils.js';

const PREVIEW_RESOLUTION_DPI = 300;
const PROFILE_TYPES = /** @type {const} */ (['advanced', 'qualified']);
const SAMPLE_ANNOTATIONS = [
    {type: ANNOTATION_TYPE_IDS.REFERENCE_NUMBER, value: '247/1/2026-S'},
    {type: ANNOTATION_TYPE_IDS.INVOICE_NUMBER, value: '1234567890'},
    {type: ANNOTATION_TYPE_IDS.INTENDED_USE, value: 'Test'},
];

/** @typedef {{count: number, url: string, error: string, loading: boolean}} ProfilePreview */
/** @typedef {{type: string, profile: import('../api.js').EsignProfile, previews: ProfilePreview[]}} ProfileEntry */

export class EsignPlaygroundProfiles extends LangMixin(
    ScopedElementsMixin(AuthMixin(DBPLitElement)),
    createInstance,
) {
    constructor() {
        super();
        this.entryPointUrl = '';
        this._api = new EsignApi(this);
        /** @type {ProfileEntry[]} */
        this._profiles = [];
        this._profilesLoading = false;
        this._profilesError = '';
        this._profileRequest = 0;
        /** @type {Record<string, string>} */
        this._annotationValues = Object.fromEntries(
            SAMPLE_ANNOTATIONS.map(({type, value}) => [type, value]),
        );
        this._previewAnnotationValues = {...this._annotationValues};
        /** @type {Set<string>} */
        this._previewUrls = new Set();
        /** @type {Map<Element, {entry: ProfileEntry, preview: ProfilePreview, request: number}>} */
        this._previewTargets = new Map();
        this._previewObserver = new IntersectionObserver(
            (entries) => this._handlePreviewIntersection(entries),
            {rootMargin: '100px'},
        );
    }

    static get properties() {
        return {
            ...super.properties,
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            _profiles: {state: true},
            _profilesLoading: {state: true},
            _profilesError: {state: true},
            _annotationValues: {state: true},
        };
    }

    static get scopedElements() {
        return {
            'dbp-button': Button,
        };
    }

    loginCallback() {
        void this._loadProfiles();
    }

    logoutCallback() {
        this._resetProfiles();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._resetProfiles();
    }

    _clearPreviewUrls() {
        for (const url of this._previewUrls) URL.revokeObjectURL(url);
        this._previewUrls.clear();
    }

    _resetProfiles() {
        // Invalidate pending responses before releasing their preview URLs.
        this._profileRequest++;
        this._previewObserver.disconnect();
        this._previewTargets.clear();
        this._clearPreviewUrls();
        this._profiles = [];
        this._profilesError = '';
        this._profilesLoading = false;
    }

    _handleAnnotationInput(event) {
        const input = event.currentTarget;
        this._annotationValues = {...this._annotationValues, [input.name]: input.value};
    }

    async _loadProfiles() {
        this._resetProfiles();
        const request = this._profileRequest;
        if (!this.isConnected || !this.isLoggedIn() || !this.auth?.token || !this.entryPointUrl)
            return;

        // Lazy previews use the values applied at reload, not unfinished input edits.
        this._previewAnnotationValues = {...this._annotationValues};
        this._profilesLoading = true;
        try {
            const results = await Promise.all(
                PROFILE_TYPES.map((type) => this._api.getProfiles(type)),
            );
            if (request !== this._profileRequest) return;
            this._profiles = results.flatMap((profiles, index) =>
                profiles.map((profile) => ({
                    type: PROFILE_TYPES[index],
                    profile,
                    previews: profile.invisible
                        ? []
                        : (profile.allowAnnotations ? [0, 1, SAMPLE_ANNOTATIONS.length] : [0]).map(
                              (count) => ({
                                  count,
                                  url: '',
                                  error: '',
                                  loading: false,
                              }),
                          ),
                })),
            );
        } catch (error) {
            if (request === this._profileRequest) this._profilesError = error.message;
        } finally {
            if (request === this._profileRequest) this._profilesLoading = false;
        }
    }

    _observePreview(element, entry, preview) {
        if (!element || preview.url || preview.error || preview.loading) return;
        this._previewTargets.set(element, {entry, preview, request: this._profileRequest});
        this._previewObserver.observe(element);
    }

    _handlePreviewIntersection(entries) {
        for (const intersection of entries) {
            if (!intersection.isIntersecting) continue;
            const target = this._previewTargets.get(intersection.target);
            if (!target) continue;
            this._previewObserver.unobserve(intersection.target);
            this._previewTargets.delete(intersection.target);
            void this._loadPreview(target.entry, target.preview, target.request);
        }
    }

    async _loadPreview(entry, preview, request) {
        const token = this.auth?.token;
        if (
            !token ||
            request !== this._profileRequest ||
            preview.loading ||
            preview.url ||
            preview.error
        )
            return;
        preview.loading = true;
        const url =
            combineURLs(this.entryPointUrl, '/esign/preview/') +
            encodeURIComponent(entry.profile.identifier) +
            '?resolution=' +
            PREVIEW_RESOLUTION_DPI;
        const language = entry.profile.language === 'de' ? 'de' : 'en';
        const annotations = SAMPLE_ANNOTATIONS.slice(0, preview.count).map(({type}) => ({
            [getAnnotationType(type).name[language]]: this._previewAnnotationValues[type],
        }));
        try {
            const response = await fetch(url, {
                method: preview.count ? 'POST' : 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Accept-Language': this.lang,
                    ...(preview.count ? {'Content-Type': 'application/json'} : {}),
                },
                ...(preview.count ? {body: JSON.stringify({annotations})} : {}),
            });
            if (!response.ok) throw await ApiError.fromResponse(response);
            const blob = await response.blob();
            if (request !== this._profileRequest) return;
            preview.url = URL.createObjectURL(blob);
            this._previewUrls.add(preview.url);
        } catch (error) {
            if (request !== this._profileRequest) return;
            preview.error = error.message;
        } finally {
            preview.loading = false;
        }
        this.requestUpdate();
    }

    _formatProfileValue(value) {
        if (typeof value === 'boolean')
            return this._i18n.t(value ? 'esign-playground.yes' : 'esign-playground.no');
        if (value === null) return 'null';
        return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    }

    _getProfilePropertyLabel(key) {
        const i18n = this._i18n;
        /** @type {Record<string, string>} */
        const labels = {
            identifier: i18n.t('esign-playground.property-identifier'),
            allowAnnotations: i18n.t('esign-playground.property-allow-annotations'),
            allowManualPositioning: i18n.t('esign-playground.property-allow-manual-positioning'),
            displayNameEn: i18n.t('esign-playground.property-display-name-en'),
            displayNameDe: i18n.t('esign-playground.property-display-name-de'),
            language: i18n.t('esign-playground.property-language'),
            invisible: i18n.t('esign-playground.property-invisible'),
        };
        return Object.hasOwn(labels, key) ? labels[key] : key;
    }

    _getPreviewLabel(count) {
        if (count === 0) return this._i18n.t('esign-playground.base-preview');
        if (count === 1) return this._i18n.t('esign-playground.one-annotation');
        return this._i18n.t('esign-playground.all-annotations');
    }

    _renderProfilePreview(entry, preview) {
        const i18n = this._i18n;
        if (preview.error)
            return html`
                <p class="error" role="alert">
                    ${i18n.t('esign-playground.preview-error', {message: preview.error})}
                </p>
            `;
        if (!preview.url)
            return html`
                <div class="preview-placeholder">${i18n.t('esign-playground.loading-preview')}</div>
            `;
        return html`
            <a
                class="preview-link"
                href="${preview.url}"
                target="_blank"
                rel="noopener noreferrer"
                title="${i18n.t('esign-playground.open-preview')}">
                <img
                    class="profile-preview"
                    src="${preview.url}"
                    alt="${i18n.t('esign-playground.profile-preview-alt', {profile: entry.profile.identifier, count: preview.count})}"
                    @error="${() => {
                        preview.error = i18n.t('esign-playground.invalid-image');
                        this.requestUpdate();
                    }}" />
            </a>
        `;
    }

    _renderProfile(entry, index) {
        const i18n = this._i18n;
        const profile = entry.profile;
        const displayName = this.lang === 'de' ? profile.displayNameDe : profile.displayNameEn;
        const properties = Object.entries(profile).filter(
            ([key]) => key !== 'identifier' && key !== '@id' && key !== '@type',
        );

        // Bind textContent so pre-wrap preserves data, not the template's indentation.
        return html`
            <article class="profile" aria-labelledby="profile-heading-${index}">
                <header>
                    <h3 id="profile-heading-${index}">${displayName || profile.identifier}</h3>
                </header>
                <table class="profile-properties">
                    <caption>${i18n.t('esign-playground.profile-info')}</caption>
                    <tbody>
                        <tr>
                            <th scope="row">${this._getProfilePropertyLabel('identifier')}</th>
                            <td .textContent="${profile.identifier}"></td>
                        </tr>
                        <tr>
                            <th scope="row">${i18n.t('esign-playground.signature-type')}</th>
                            <td
                                .textContent="${entry.type === 'advanced' ? i18n.t('esign-playground.advanced') : i18n.t('esign-playground.qualified')}"></td>
                        </tr>
                        ${properties.map(
                            ([key, value]) => html`
                                <tr>
                                    <th scope="row">${this._getProfilePropertyLabel(key)}</th>
                                    <td .textContent="${this._formatProfileValue(value)}"></td>
                                </tr>
                            `,
                        )}
                    </tbody>
                </table>
                ${
                    profile.invisible
                        ? html`
                              <p>${i18n.t('esign-playground.invisible-profile')}</p>
                          `
                        : html`
                              <div class="profile-previews">
                                  ${entry.previews.map(
                                      (preview) => html`
                                          <figure
                                              ${ref((element) => this._observePreview(element, entry, preview))}>
                                              <figcaption>
                                                  ${this._getPreviewLabel(preview.count)}
                                              </figcaption>
                                              ${this._renderProfilePreview(entry, preview)}
                                          </figure>
                                      `,
                                  )}
                              </div>
                          `
                }
            </article>
        `;
    }

    render() {
        const i18n = this._i18n;
        return html`
            <section aria-labelledby="profiles-heading">
                <h2 id="profiles-heading">${i18n.t('esign-playground.profiles-heading')}</h2>
                <p>${i18n.t('esign-playground.profiles-description')}</p>
                <fieldset class="annotation-settings">
                    <legend id="annotation-values-heading">
                        ${i18n.t('esign-playground.annotation-values')}
                    </legend>
                    <table class="annotation-inputs" aria-labelledby="annotation-values-heading">
                        <tbody>
                            ${SAMPLE_ANNOTATIONS.map(
                                ({type}) => html`
                                    <tr>
                                        <th scope="row">
                                            <label for="annotation-${type}">
                                                ${getAnnotationType(type).name[this.lang === 'de' ? 'de' : 'en']}
                                            </label>
                                        </th>
                                        <td>
                                            <input
                                                class="input"
                                                type="text"
                                                id="annotation-${type}"
                                                name="${type}"
                                                .value="${this._annotationValues[type]}"
                                                @input="${this._handleAnnotationInput}" />
                                        </td>
                                    </tr>
                                `,
                            )}
                        </tbody>
                    </table>
                </fieldset>
                <dbp-button
                    type="is-secondary"
                    no-spinner-on-click
                    ?disabled="${this._profilesLoading || !this.isLoggedIn() || !this.entryPointUrl}"
                    @click="${this._loadProfiles}">
                    ${i18n.t('esign-playground.reload-profiles')}
                </dbp-button>
                <div aria-live="polite">
                    ${
                        !this.isLoggedIn()
                            ? html`
                                  <p>${i18n.t('esign-playground.login-required')}</p>
                              `
                            : ''
                    }
                    ${
                        this._profilesLoading
                            ? html`
                                  <p>${i18n.t('esign-playground.loading-profiles')}</p>
                              `
                            : ''
                    }
                    ${
                        this._profilesError
                            ? html`
                                  <p class="error" role="alert">
                                      ${i18n.t('esign-playground.profiles-error', {message: this._profilesError})}
                                  </p>
                              `
                            : ''
                    }
                    ${
                        this.isLoggedIn() &&
                        this.entryPointUrl &&
                        !this._profilesLoading &&
                        !this._profilesError &&
                        !this._profiles.length
                            ? html`
                                  <p>${i18n.t('esign-playground.no-profiles')}</p>
                              `
                            : ''
                    }
                </div>
                ${
                    this._profiles.length
                        ? html`
                              <div class="profiles" aria-busy="${this._profilesLoading}">
                                  ${this._profiles.map((entry, index) => this._renderProfile(entry, index))}
                              </div>
                          `
                        : ''
                }
            </section>
        `;
    }

    static get styles() {
        return css`
            ${commonStyles.getGeneralCSS()}

            :host {
                display: block;
                min-width: 0;
            }

            .profiles {
                margin-top: 2rem;
            }

            .annotation-settings {
                margin: 1rem 0;
                padding: 0;
                border: 0;
                min-width: 0;
            }

            .annotation-settings legend {
                padding: 0;
                margin-bottom: 0.5rem;
                font-weight: bold;
            }

            .annotation-inputs {
                width: 100%;
                max-width: 36rem;
                table-layout: fixed;
                border-collapse: collapse;
            }

            .annotation-inputs th,
            .annotation-inputs td {
                vertical-align: middle;
                white-space: normal;
            }

            .annotation-inputs input {
                box-sizing: border-box;
                width: 100%;
            }

            .profile + .profile {
                margin-top: 2rem;
                padding-top: 2rem;
                border-top: 1px solid var(--dbp-muted, #ccc);
            }

            h3 {
                margin: 0 0 1rem;
                overflow-wrap: anywhere;
            }

            .profile-properties {
                width: 100%;
                max-width: 36rem;
                table-layout: fixed;
                border-collapse: collapse;
                margin-bottom: 1.5rem;
            }

            caption {
                text-align: left;
                font-weight: bold;
                padding-bottom: 0.75rem;
            }

            th,
            td {
                padding: 0.25rem 0.5rem;
                line-height: 1.3;
                text-align: left;
                vertical-align: top;
                border-bottom: 1px solid var(--dbp-muted, #ccc);
                overflow-wrap: anywhere;
            }

            th {
                width: 35%;
                font-weight: bold;
            }

            td {
                white-space: pre-wrap;
            }

            .profile-previews {
                display: flex;
                flex-wrap: wrap;
                align-items: flex-start;
                gap: 1.5rem;
            }

            figure {
                margin: 0;
                width: 24rem;
                max-width: 100%;
                min-width: 0;
            }

            figcaption {
                font-weight: bold;
                margin-bottom: 0.5rem;
            }

            .profile-preview {
                display: block;
                width: 100%;
                height: auto;
                background: white;
            }

            .preview-placeholder {
                min-height: 8rem;
                display: grid;
                place-items: center;
            }

            .preview-link {
                display: block;
                cursor: zoom-in;
            }

            .preview-link:focus-visible {
                outline: 2px solid var(--dbp-content, #333);
                outline-offset: 3px;
            }

            .error {
                color: var(--dbp-danger, #a00);
                overflow-wrap: anywhere;
            }
        `;
    }
}
