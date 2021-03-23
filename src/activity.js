export class Activity {
    constructor(data) {
        this._data = data;
        this._defaultLang = 'en';
    }

    getName(lang) {
        let desc = this._data['name'];
        return desc[lang] ?? desc['en'];
    }

    getDescription(lang) {
        let desc = this._data['description'];
        return desc[lang] ?? desc['en'];
    }
}