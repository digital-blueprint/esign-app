import {AnnotationFactory} from '@digital-blueprint/annotpdf/_bundles/pdfAnnotate.js';
import {html} from 'lit';
import {createInstance} from './i18n.js';
//import {humanFileSize} from "@dbp-toolkit/common/i18next";

/**
 * Finds an object in a JSON result by identifier
 *
 * @param identifier
 * @param results
 * @param identifierAttribute
 */
export const findObjectInApiResults = (identifier, results, identifierAttribute = '@id') => {
    const members = results['hydra:member'];

    if (members === undefined) {
        return;
    }

    for (const object of members) {
        if (object[identifierAttribute] === identifier) {
            return object;
        }
    }
};

export const convertDataURIToBinary = (dataURI) => {
    const BASE64_MARKER = ';base64,';
    const base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
    const base64 = dataURI.substring(base64Index);
    const raw = window.atob(base64);
    const rawLength = raw.length;
    let array = new Uint8Array(rawLength);

    for (let i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }

    return array;
};

export const getDataURIContentType = (dataURI) => {
    const BASE64_MARKER = ';base64,';
    const base64Index = dataURI.indexOf(BASE64_MARKER);

    return dataURI.substring(5, base64Index);
};

export const fabricjs2pdfasPosition = (data) => {
    let angle = -(data.angle - 360) % 360;
    let bottom = data.bottom;
    let left = data.left;

    if (data.angle === 90) {
        bottom += data.height;
        left -= data.height;
    } else if (data.angle === 180) {
        bottom += data.height * 2;
    } else if (data.angle === 270) {
        bottom += data.height;
        left += data.height;
    }

    return {
        y: bottom,
        x: left,
        r: angle,
        w: data.width, // only width, no "height" allowed in PDF-AS
        p: data.currentPage,
    };
};

/**
 * Returns the content of the file
 *
 * @param {File} file The file to read
 * @returns {string} The content
 */
export const readBinaryFileContent = async (file) => {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result);
        };
        reader.onerror = () => {
            reject(reader.error);
        };
        reader.readAsBinaryString(file);
    });
};

/**
 * Returns the content of the file as array buffer
 *
 * @param {File} file The file to read
 * @returns {string} The content
 */
export const readArrayBufferFileContent = async (file) => {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result);
        };
        reader.onerror = () => {
            reject(reader.error);
        };
        reader.readAsArrayBuffer(file);
    });
};

/**
 * Given a PDF file returns the amount of signatures found in it.
 *
 * Note that this uses an heuristic, so the result can be wrong
 * (improvements welcome).
 *
 * @param {File} file The PDF file object
 * @returns {number} The amount of signatures found
 */
export const getPDFSignatureCount = async (file) => {
    const sigRegex = new RegExp(
        '(/Type\\s*/Sig|/Filter\\s*/Adobe.PPKLite)[\\s\\S]*?/SubFilter\\s*(/ETSI\\.CAdES\\.detached|/adbe\\.pkcs7\\.detached)',
        'g',
    );
    const content = await readBinaryFileContent(file);
    let matches = 0;
    while (sigRegex.exec(content) !== null) {
        matches++;
    }
    return matches;
};

/**
 * Returns a File from an AnnotationFactory
 *
 * @param annotationFactory
 * @param file
 * @returns {File} file given as parameter, but with annotations
 */
export const writeAnnotationFactoryToFile = (annotationFactory, file) => {
    const blob = annotationFactory.write();

    return new File([blob], file.name, {type: file.type});
};

/**
 * Creates an AnnotationFactory from a File
 *
 * @param file
 * @returns {AnnotationFactory} from given file
 */
export const getAnnotationFactoryFromFile = async (file) => {
    const data = await readArrayBufferFileContent(file);

    return new AnnotationFactory(data);
};

/**
 * Adds a key/value annotation to a AnnotationFactory and returns the AnnotationFactory
 *
 * @param annotationFactory
 * @param personName
 * @param annotationType
 * @param annotationTypeNameDE
 * @param annotationTypeNameEN
 * @param value
 * @returns {AnnotationFactory} prepared to annotate
 */
export const addKeyValuePdfAnnotationsToAnnotationFactory = (
    annotationFactory,
    personName,
    annotationType,
    annotationTypeNameDE,
    annotationTypeNameEN,
    value,
) => {
    annotationType = annotationType.trim();
    annotationTypeNameDE = annotationTypeNameDE.trim();
    annotationTypeNameEN = annotationTypeNameEN.trim();
    value = value.trim();

    // don't annotate if key or value are empty
    if (annotationType === '' || value === '') {
        return annotationFactory;
    }

    // add human-readable annotation
    let hostname = window.location.hostname;
    let author = personName + ' via  "' + hostname + '"';
    let content = annotationTypeNameDE + ': ' + value + '\n' + annotationTypeNameEN + ': ' + value;
    annotationFactory = addPdfAnnotationToAnnotationFactory(annotationFactory, author, content);

    // add machine-readable annotation
    author =
        'Maschinell aufgebracht, bitte nicht entfernen / Applied automatically, please do not remove';
    content = 'dbp_annotation_' + annotationType + '=' + value;
    annotationFactory = addPdfAnnotationToAnnotationFactory(annotationFactory, author, content);

    return annotationFactory;
};

export const addPdfAnnotationToAnnotationFactory = (annotationFactory, author, content) => {
    author = author.trim();
    content = content.trim();

    // don't annotate if author of content are empty
    if (author === '' || content === '') {
        return annotationFactory;
    }

    const page = 0;
    const rect = [0, 0, 0, 0];

    // annotationFactory.checkRect(4, rect);

    // Create single free text annotation with print flag and 0 font size
    let annotation = Object.assign(
        annotationFactory.createBaseAnnotation(page, rect, content, author),
        {
            annotation_flag: 4, // enable print to be PDF/A conform
            color: {r: 1, g: 1, b: 1}, // white to (maybe) hide it better
            opacity: 0.001, // we can't set to 0 because of "if (opacity) {"
            defaultAppearance: '/Invalid_font 0 Tf', // font size 0 to (maybe) hide it better
        },
    );
    annotation.type = '/FreeText';
    annotationFactory.annotations.push(annotation);

    return annotationFactory;
};

/**
 * Returns an object with all annotations types or only the values for one type
 *
 * @param key
 * @returns {object} describing the annotation type named key
 */
export const getAnnotationTypes = (key = null) => {
    // for i18next-cli
    let i18n = createInstance();
    i18n.t('annotation-view.reference-number-placeholder');
    i18n.t('annotation-view.intended-use-placeholder');

    const types = {
        bbe3a371: {
            name: {
                de: 'Geschäftszahl',
                en: 'Reference number',
            },
            placeholderTextId: 'annotation-view.reference-number-placeholder',
        },
        '85a4eb4c': {
            name: {
                de: 'Verwendungszweck',
                en: 'Intended use',
            },
            placeholderTextId: 'annotation-view.intended-use-placeholder',
        },
    };

    return key === null ? types : types[key] || {};
};

/**
 * Returns the html for the annotation type select
 *
 * @param selectedKey
 * @param lang
 * @returns {Array} Array of html templates
 */
export const getAnnotationTypeSelectOptionsHtml = (selectedKey, lang) => {
    const annotationTypes = getAnnotationTypes();
    const keys = Object.keys(annotationTypes);
    let results = [];

    keys.forEach((key) => {
        const name = annotationTypes[key].name[lang];
        results.push(html`
            <option value="${key}" .selected=${selectedKey === key}>${name}</option>
        `);
    });

    return results;
};

/**
 * @param {string} fileName
 * @returns {string}
 */
export function generateSignedFileName(fileName) {
    const parts = fileName.split('.');

    let name, ext;

    if (parts.length < 2) {
        name = parts[0];
        ext = '';
    } else {
        ext = parts.at(-1);
        name = parts.at(-2);
    }

    const prevName = parts.length >= 2 ? parts.slice(0, -2) : [];

    if (name.endsWith('-sig')) {
        return fileName;
    }

    let prefix = '';
    if (prevName.length > 0) {
        prefix = prevName.join('.') + '.';
    }

    if (ext) {
        ext = '.' + ext;
    }

    return prefix + name + '-sig' + ext;
}
