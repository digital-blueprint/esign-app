# VPU Offical Digital Signing Application

[GitLab Repository](https://gitlab.tugraz.at/VPU/Apps/Signature)

## Local development

```bash
# get the source
git clone git@gitlab.tugraz.at:VPU/Apps/Signature.git
cd Signature
git submodule update --init

# install dependencies (make sure you have npm version 4+ installed, so symlinks to the git submodules are created automatically)
npm install

# constantly build dist/bundle.js and run a local web-server on port 8001 
npm run watch-local

# run tests
npm test
```

Jump to <http://localhost:8001> and you should get a Single Sign On login page.

## Browser versions

These browser versions should work with the application.

- Firefox 67+ (2019-05)
- Chrome 67+ (2018-05)
- Edge 79+ (2020-01)
- Safari 11.1+ (2018-04)
- Opera 64+ (2019-10)
- iOS Safari 12+/iOS 12+ (2018-09)

We use a row of newer features:

- https://caniuse.com/#feat=custom-elementsv1
- https://caniuse.com/#feat=es6-module-dynamic-import
- https://caniuse.com/#feat=shadowdomv1
- https://caniuse.com/#feat=mdn-javascript_statements_import_meta
- https://caniuse.com/#feat=es6-module
- https://caniuse.com/#feat=async-functions