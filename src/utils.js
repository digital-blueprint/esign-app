import {AnnotationFactory} from '@digital-blueprint/annotpdf/_bundles/pdfAnnotate.js';

/**
 * Finds an object in a JSON result by identifier
 *
 * @param identifier
 * @param results
 * @param identifierAttribute
 */
export const findObjectInApiResults = (identifier, results, identifierAttribute = "@id") => {
    const members = results["hydra:member"];

    if (members === undefined) {
        return;
    }

    for (const object of members) {
        if (object[identifierAttribute] === identifier) {
            return object;
        }
    }
};

export const getPDFFileBase64Content = (file) => {
    return file.contentUrl.replace(/data:\s*application\/pdf;\s*base64,/, "");
};

export const convertDataURIToBinary = (dataURI) => {
    const BASE64_MARKER = ';base64,';
    const base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
    const base64 = dataURI.substring(base64Index);
    const raw = window.atob(base64);
    const rawLength = raw.length;
    let array = new Uint8Array(rawLength);

    for(let i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }

    return array;
};

export const getDataURIContentType = (dataURI) => {
    const BASE64_MARKER = ';base64,';
    const base64Index = dataURI.indexOf(BASE64_MARKER);

    return dataURI.substring(5, base64Index);
};

export const baseName = (str) =>
{
    let base = String(str).substring(str.lastIndexOf('/') + 1);

    if (base.lastIndexOf(".") !== -1) {
        base = base.substring(0, base.lastIndexOf("."));
    }

    return base;
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
        y: Math.round(bottom),
        x: Math.round(left),
        r: angle,
        w: Math.round(data.width), // only width, no "height" allowed in PDF-AS
        p: data.currentPage
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
        "/Type\\s*/Sig(.|\\s)*?/SubFilter\\s*(/ETSI\\.CAdES\\.detached|/adbe\\.pkcs7\\.detached)",
        "g");
    const content = await readBinaryFileContent(file);
    let matches = 0;
    while (sigRegex.exec(content) !== null) {
        matches++;
    }
    return matches;
};

/**
 * Adds an annotation to a PDF file
 *
 * @param file
 * @param i18n
 * @param appName
 * @param personName
 * @param key
 * @param value
 * @returns {File}
 */
export const addKeyValuePdfAnnotation = async (file, i18n, appName, personName, key, value) => {
    key = key.trim();
    value = value.trim();

    // don't annotate if key or value are empty
    if (key === '' || value === '') {
        return file;
    }

    let annotationFactory = await getAnnotationFactoryFromFile(file);
    annotationFactory = addKeyValuePdfAnnotationToAnnotationFactory(annotationFactory, i18n, appName, personName, key, value);

    return writeAnnotationFactoryToFile(annotationFactory, file);
};

/**
 * Returns a File from an AnnotationFactory
 *
 * @param annotationFactory
 * @param file
 * @returns {File}
 */
export const writeAnnotationFactoryToFile = (annotationFactory, file) => {
    const blob = annotationFactory.write();

    return new File([blob], file.name, { type: file.type });
}

/**
 * Creates an AnnotationFactory from a File
 *
 * @param file
 * @returns AnnotationFactory
 */
export const getAnnotationFactoryFromFile = async (file) => {
    const data = await readArrayBufferFileContent(file);

    return new AnnotationFactory(data);
};

/**
 * Adds a key/value annotation to a AnnotationFactory and returns the AnnotationFactory
 *
 * @param annotationFactory
 * @param i18n
 * @param appName
 * @param personName
 * @param key
 * @param value
 * @returns PdfFactory
 */
export const addKeyValuePdfAnnotationToAnnotationFactory = (annotationFactory, i18n, appName, personName, key, value) => {
    key = key.trim();
    value = value.trim();

    // don't annotate if key or value are empty
    if (key === '' || value === '') {
        return annotationFactory;
    }

    // console.log("annotationFactory.getAnnotations() before", annotationFactory.getAnnotations());

    const page = 0;
    const rect = [1, 1, 1, 1];
    const author = i18n.t('annotation-author', {
        appName: appName,
        personName: personName
    });
    const contents = 'dbp-annotation-' + key + '=' + value;

    // annotationFactory.checkRect(4, rect);

    // Create single free text annotation with print flag and 0 font size
    let annotation = Object.assign(annotationFactory.createBaseAnnotation(page, rect, contents, author), {
        annotation_flag: 4, // enable print to be PDF/A conform
        color: {r: 1, g: 1, b: 1}, // white to (maybe) hide it better
        opacity: 0.001, // we can't set to 0 because of "if (opacity) {"
        defaultAppearance: "/Invalid_font 0 Tf" // font size 0 to (maybe) hide it better
    });
    annotation.type = "/FreeText";
    annotationFactory.annotations.push(annotation);

    return annotationFactory;
};
