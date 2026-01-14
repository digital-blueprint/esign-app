# Changelog

## 2.6.0

- New app shell/menu layout

## 2.5.2

- Fix various layout issues with PDFs wich overly long file names without spaces.
- Various minor theme updates
- Fix wrong error message in case qualified signature permissions are missing
  for the user

## 2.5.1

- Some minor translation fixes
- Some minor styling fixes
- Avoid eval errors with the default CSP
- Lazy loading of pdf.js
- Various dependency updates

## 2.5.0

- Added toggle switch for automatic/manual signature positioning with screen reader support
- Fixed manual positioning switch toggling incorrectly when closing preview
- Delete button now removes only selected files instead of the entire queue
- Improved collapsed rows handling and fixed positioning buttons inside them
- Fixed error when canceling signature placement modal
- Only one manual-positioning warning is now displayed at a time
- Added more space between tables and set fixed row heights
- Replaced edit button with dedicated positioning column button

## 2.4.1

- Fix disabling of the signature annotation feature not working anymore starting with 2.4.0 (enableAnnotations in the app.config)

## 2.4.0

- Ported the signature queue and result lists to proper tables with selection controls

## 2.3.2

- Update to pdf.js v4.4.168
- Port package build to ESM
- Port to fabric v6

## 2.3.1

- Fix certain PDF annotations breaking the PDF viewer since 2.3.0
- Fix certain PDF annotations being displayed twice since 2.2.3

## 2.3.0

- Update welcome text
- Update pdf.js to v4.3.136 (bumps the minimum required Safari version to 15 and Firefox to 114)

## 2.2.3

- Disable eval() usage in pdf.js to protect against CVE-2024-4367 even without a CSP active.
- Update pdf.js to v3.0.279 (latest version working with Safari 13.1)
- Fix file selection in the cloud file picker
- Enhance the application metadata that is used by search engines.
- Add various aria labels to improve accessibility.

## 2.2.2

- Disallow unsafe-eval via CSP to protect against CVE-2024-4367.
  A pdf.js update will follow.
- Fix broken/missing form validation for PDF annotations with newer browsers.

## 2.2.1

- Various dependency updates

## 2.2.0

- Drop support for old esign bundle versions providing old API endpoints
- annotations: allow colons in pdf annotation values
- Add service.a-trust.at to the CSP headers. Fixes the iframe in case pdf-as is
  configured to use it instead of www.handy-signatur.at
- Require node v18 to build
- Various dependency updates
- Various minor theme updates
