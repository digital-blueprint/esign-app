import {css} from 'lit';

export function getSignatureCss() {
    // language=css
    return css`
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

        #pdf-preview,
        #annotation-view {
            min-width: 75vw;
            box-sizing: border-box;
            background-color: var(--dbp-background);
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
            margin-bottom: 40px;
        }

        .files-block .file {
            margin: 10px 0;
        }

        .error-files .file {
            display: grid;
            grid-template-columns: 40px auto;
        }

        .files-block .file .button-box {
            display: flex;
            align-items: center;
        }

        .files-block .file .info {
            display: inline-block;
            vertical-align: middle;
        }

        .file .info strong {
            font-weight: 600;
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
            margin: 10px 0;
        }

        #grid-container {
            display: flex;
            flex-direction: column;
        }

        /*#grid-container > div {
            margin-right: 20px;
        }

        #grid-container > div:last-child {
            margin-right: 0;
            flex: 1 0;
        }*/

        .file-block,
        .box {
            border: var(--dbp-border);
            padding: 10px;
        }

        .file-block,
        .box .file {
            margin-top: 0;
        }

        .file-block {
            width: 320px;
            margin-bottom: 10px;
        }

        .file-block .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            grid-gap: 10px;
        }

        .file-block .header button{
            flex-shrink: 0;
        }

        .file-block.error .header {
            grid-template-columns: auto 80px;
        }

        .file-block.error .header .buttons {
            white-space: nowrap;
        }

        .file-block div.bottom-line {
            display: grid;
            align-items: center;
            grid-template-columns: auto auto;
            grid-gap: 6px;
            margin-top: 6px;
        }

        .file-block .error-line {
            margin-top: 6px;
            color: var(--dbp-danger);
        }

        .file-block.error div.bottom-line {
            display: block;
        }

        .file-block div.bottom-line .headline {
            text-align: right;
        }

        .file-block .filename,
        .file-block div.bottom-line .headline {
            text-overflow: ellipsis;
            overflow: hidden;
        }

        .file-block .filename {
            white-space: nowrap;
        }

        .bold-filename {
            font-weight: bold;
        }

        .error-files .control,
        .signed-files .control {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 1em;
        }

        #pdf-preview button.is-cancel, .box-header .is-cancel {
            background: transparent;
            border: none;
            font-size: 1.5rem;
            color: var(--dbp-accent);
            cursor: pointer;
            padding: 0px 2px;
            margin-top: -5px;
        }

        .is-right {
            float: right;
        }

        .error-files .header {
            color: black;
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

        #pdf-preview,
        #annotation-view {
            position: absolute;
            top: 100px;
            height: 90vh;
            overflow: auto;
            padding-bottom: 30px;
            right: 8vw;
            max-width: 75vw;
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

        #grid-container {
            margin-top: 2rem;
            /*padding-top: 2rem;*/
        }

        .border {
            border-top: var(--dbp-border);
            margin-top: 2rem;
            padding-top: 2rem;
        }

        .placement-missing {
            border: var(--dbp-danger);
            border-width: 2px;
            border-radius: var(--dbp-border-radius);
        }

        .subheadline {
            font-style: italic;
            padding-left: 2em;
            margin-top: -1px;
            /*line-height: 1.8;*/
            margin-bottom: 1.2em;
        }

        .tabulator-actions {
            display: flex;
            gap: 1em;
            justify-content: space-between;
            flex-wrap: wrap;
            container: tabulator-actions / inline-size;
        }

        .table-actions,
        .sign-actions {
            display: flex;
            gap: 1em;
            flex-wrap: wrap;
        }

        #table-queued-files,
        #table-signed-files,
        #table-failed-files {
            --dbp-tabulator-collapse-padding-left: 68px;
            --dbp-tooltip-icon-color: red;
        }

        #table-queued-files {
            --dbp-tabulator-cell-overflow: visible;
        }

        @container tabulator-actions (max-width: 660px) {
            .table-actions,
            .sign-actions {
                width: 100%;
            }

            .table-actions > dbp-loading-button:not(.hidden),
            .sign-actions > button {
                flex-basis: calc(50% - 1em);
            }
        }

        @container tabulator-actions (max-width: 420px) {
            .table-actions,
            .sign-actions {
                flex-direction: column;
            }
        }

        @media only screen and (orientation: portrait) and (max-width: 768px) {
            /* Modal preview, upload and external auth */
            div.right-container > * {
                position: fixed;
                z-index: 1000;
                padding: 10px;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: var(--dbp-background);
                color: var(--dbp-content);
                overflow-y: scroll;
            }

            /* Don't use the whole screen for the upload progress */
            #upload-progress {
                top: 10px;
                left: 10px;
                right: 10px;
                bottom: inherit;
            }

            #grid-container > div {
                margin-right: 0;
                width: 100%;
            }

            .file-block {
                width: inherit;
            }

            #pdf-preview,
            #annotation-view {
                position: fixed;
                max-width: initial;
                width: 100%;
            }
        }
    `;
}
