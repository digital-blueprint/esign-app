import {css} from 'lit-element';

export function getSignatureCss() {
    // language=css
    return css`

        #annotation-view .button.is-cancel {
            background: transparent;
            border: none;
            font-size: 1.5rem;
            color: var(--dbp-override-danger-bg-color);
            cursor: pointer;
            padding: 0px;
            padding-right: 2px;
        }

        #annotation-view .box-header, #external-auth .box-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
        }

        #annotation-view .box-header .filename, #external-auth .box-header .filename {
            overflow: hidden;
            text-overflow: ellipsis;
            margin-right: 0.5em;
        }

        #pdf-preview, #annotation-view {
            min-width: 320px;
            box-sizing: border-box;
        }

        h2:first-child {
            margin-top: 0;
            margin-bottom: 0px;
        }

        strong {
            font-weight: 600;
        }

        #pdf-preview .box-header, #annotation-view .box-header {
            border: 1px solid #000;
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

        .error, #cancel-signing-process {
            color: #e4154b;
        }

        #cancel-signing-process:hover {
            color: white;
        }

        /* using dbp-icon doesn't work */
        button > [name=close], a > [name=close] {
            font-size: 0.8em;
        }

        a > [name=close] {
            color: red;
        }

        .empty-queue {
            margin: 10px 0;
        }

        #grid-container {
            display: flex;
            flex-flow: row wrap;
        }

        #grid-container > div {
            margin-right: 20px;
        }

        #grid-container > div:last-child {
            margin-right: 0;
            flex: 1 0;
        }
        
        .file-block, .box {
            border: solid 1px black;
            padding: 10px;
        }

        .file-block, .box .file {
            margin-top: 0;
        }


        .file-block {
            max-width: 320px;
            margin-bottom: 10px;
        }

        .file-block .header {
            display: grid;
            align-items: center;
            grid-template-columns: auto 40px;
            grid-gap: 10px;
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
            color: var(--dbp-override-danger-bg-color);
        }

        .file-block.error div.bottom-line {
            display: block;
        }

        .file-block div.bottom-line .headline {
            text-align: right;
        }

        .file-block .filename, .file-block div.bottom-line .headline {
            text-overflow: ellipsis;
            overflow: hidden;
        }

        .file-block .filename {
            white-space: nowrap;
        }

        .bold-filename {
            font-weight: bold;
        }
        
        #pdf-preview .button.is-cancel {
            color: #e4154b;
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

        .is-disabled, .is-disabled.button[disabled] {
            opacity: 0.2;
            pointer-events: none;
        }

        #pdf-preview, #annotation-view {
            position: sticky;
            top: 0px;
            height: 100vh;
            overflow: auto;
            padding-bottom: 30px;
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

        #grid-container{
            margin-top: 2rem;
            /*padding-top: 2rem;*/
        }

        .border{
            border-top: 1px solid black;
            margin-top: 2rem;
            padding-top: 2rem;
        }

        .placement-missing {
            border: solid 2px var(--dbp-override-danger-bg-color);
        }

        .subheadline{
            font-style: italic;
            padding-left: 2em;
            margin-top: -1px;
            /*line-height: 1.8;*/
            margin-bottom: 1.2em;
        }

        @media only screen
        and (orientation: portrait)
        and (max-width: 768px) {
            /* Modal preview, upload and external auth */
            div.right-container > *  {
                position: fixed;
                z-index: 1000;
                padding: 10px;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: white;
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
                max-width: inherit;
            }
            
            #pdf-preview, #annotation-view {
                position: fixed;
            }
        }
    
    
    `;


}