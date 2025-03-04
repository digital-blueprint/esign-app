import {css} from 'lit';

export function getSignatureCss() {
    // language=css
    return css`

        .section-title {
            font-size: 1.4em;
            margin-bottom: 1em;
            border-left: 5px solid var(--dbp-primary);
            padding-left: .5em;
        }

        #annotation-view button.is-cancel {
            background: transparent;
            border: none;
            font-size: 1.5rem;
            color: var(--dbp-accent);
            cursor: pointer;
            padding: 0px;
            padding-right: 2px;
            margin-top: -5px;
        }

        #annotation-view .box-header,
        #external-auth .box-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
        }

        #annotation-view .box-header .filename,
        #external-auth .box-header .filename {
            overflow: hidden;
            text-overflow: ellipsis;
            margin-right: 0.5em;
        }

        h2:first-child {
            margin-top: 0;
            margin-bottom: 0px;
        }

        strong {
            font-weight: 600;
        }

        #pdf-preview .box-header,
        #annotation-view .box-header {
            border: var(--dbp-border);
            border-bottom-width: 0;
            padding: 0.5em 0.5em 0 0.5em;
        }

        .hidden {
            display: none;
        }

        .files-block.field:not(:last-child) {
            margin-bottom: 80px;
        }

        .notification dbp-mini-spinner {
            position: relative;
            top: 2px;
            margin-right: 5px;
        }

        .error,
        #cancel-signing-process {
            color: var(--dbp-danger);
        }

        #cancel-signing-process:hover {
            color: var(--dbp-hover-color);
            background-color: var(--dbp-hover-background-color);
        }

        /* using dbp-icon doesn't work */
        button > [name='close'],
        a > [name='close'] {
            font-size: 0.8em;
        }

        a > [name='close'] {
            color: var(--dbp-accent);
        }

        .button.close dbp-icon {
            margin-left: -2px;
        }

        .empty-queue {
            margin: -22px  0 0 0;
        }

        #grid-container {
            display: flex;
            flex-direction: column;
            margin-top: 2rem;
        }

        #pdf-preview button.is-cancel,
        .box-header .is-cancel {
            background: transparent;
            border: none;
            font-size: 1.5rem;
            color: var(--dbp-accent);
            cursor: pointer;
            padding: 0px 2px;
            margin-top: -5px;
        }

        /* prevent hovering of disabled default button */
        .button[disabled]:not(.is-primary):hover {
            background-color: inherit;
            color: inherit;
        }

        .is-disabled,
        .is-disabled.button[disabled] {
            opacity: 0.2;
            pointer-events: none;
        }

        #pdf-preview .box-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
        }

        #pdf-preview .box-header .filename {
            overflow: hidden;
            text-overflow: ellipsis;
            margin-right: 0.5em;
        }

        .modal-container .filename {
            padding-bottom: 1em;
        }

        .modal--pdf-preview {
            --dbp-modal-max-width: 768px;
            --dbp-modal-min-width: min(75vw, 768px);
        }

        .modal--annotation-view {
            --dbp-modal-max-width: 650px;
            --dbp-modal-min-width: min(75vw, 650px);
        }

        .modal--external-auth {
            --dbp-modal-max-width: 600px;
            --dbp-modal-min-width: min(75vw, 600px);
        }


        .tabulator-actions {
            display: flex;
            gap: 1em;
            justify-content: space-between;
            flex-wrap: wrap;
            container: tabulator-actions / inline-size;
        }

        .table-actions,
        .sign-actions,
        .signed-actions,
        .failed-actions {
            display: flex;
            gap: 1em;
            flex-wrap: wrap;
        }

        #table-queued-files,
        #table-signed-files,
        #table-failed-files {
            --dbp-tabulator-collapse-padding-left: 68px;
            --dbp-tooltip-icon-color: var(--dbp-override-danger);
            --dbp-button-size: 50px;
        }

        .legend {
            color: var(--dbp-override-danger);
            display: flex;
            justify-content: flex-start;
            align-items: center;
            gap: .75em;
            padding: 1em;
            border: var(--dbp-border);
            border-color: var(--dbp-override-danger);
        }

        .legend dbp-icon {
            font-size: 24px;
            margin-top: -5px;
            flex-shrink: 0;
        }

        #table-queued-files {
            --dbp-tabulator-cell-overflow: visible;
        }

        @container tabulator-actions (max-width: 660px) {
            .table-actions,
            .sign-actions,
            .signed-actions,
            .failed-actions {
                width: 100%;
            }

            .queued-files .table-actions > dbp-loading-button:not(.hidden),
            .queued-files .sign-actions > button,
            .signed-files .signed-actions > :is(button, dbp-loading-button),
            .error-files .failed-actions > :is(button, dbp-loading-button) {
                flex-basis: calc(50% - 1em);
            }

            :is(.signed-files, .error-files) .table-actions {
                flex-basis: calc(33%);
            }

            :is(.signed-files, .error-files) .table-actions > dbp-loading-button:not(.hidden) {
                width: 100%;
            }

            .signed-files .signed-actions,
            .error-files .failed-actions {
                flex-basis: calc(66% - 1em);
            }
        }

        @container tabulator-actions (max-width: 420px) {
            .table-actions,
            .sign-actions,
            .signed-actions,
            .failed-actions {
                display: flex;
                flex-direction: column;
            }

            .signed-files,
            .error-files {
                .tabulator-actions {
                    flex-direction: column;
                    flex-wrap: nowrap;
                }
            }

            .signed-files {
                .table-actions,
                .signed-actions {
                    flex-basis: 100%;
                }
            }

            .error-files {
                .table-actions,
                .failed-actions {
                    flex-basis: 100%;
                }
            }
        }

        @media only screen and (max-width: 900px) {
            .modal--pdf-preview {
                --dbp-modal-max-width: 85vw;
                --dbp-modal-min-width: min(85vw, 768px);
            }
        }

        @media only screen and (orientation: portrait) and (max-width: 768px) {

            /* Don't use the whole screen for the upload progress */
            #upload-progress {
                top: 10px;
                left: 10px;
                right: 10px;
                bottom: inherit;
            }
        }

        @media (max-width: 400px) {
            #table-queued-files,
            #table-signed-files,
            #table-failed-files {
                --dbp-tabulator-collapse-padding-left: 10px;
            }
        }
    `;
}
