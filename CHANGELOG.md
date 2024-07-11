# Changelog

## Unreleased

* Update to pdf.js v4.4.168
* Port package build to ESM
* Port to fabric v6

## 2.3.1

* Fix certain PDF annotations breaking the PDF viewer since 2.3.0
* Fix certain PDF annotations being displayed twice since 2.2.3

## 2.3.0

* Update welcome text
* Update pdf.js to v4.3.136 (bumps the minimum required Safari version to 15 and Firefox to 114)

## 2.2.3

* Disable eval() usage in pdf.js to protect against CVE-2024-4367 even without a CSP active.
* Update pdf.js to v3.0.279 (latest version working with Safari 13.1)
* Fix file selection in the cloud file picker
* Enhance the application metadata that is used by search engines.
* Add various aria labels to improve accessibility.

## 2.2.2

* Disallow unsafe-eval via CSP to protect against CVE-2024-4367.
  A pdf.js update will follow.
* Fix broken/missing form validation for PDF annotations with newer browsers.

## 2.2.1

* Various dependency updates

## 2.2.0

* Drop support for old esign bundle versions providing old API endpoints
* annotations: allow colons in pdf annotation values
* Add service.a-trust.at to the CSP headers. Fixes the iframe in case pdf-as is
  configured to use it instead of www.handy-signatur.at
* Require node v18 to build
* Various dependency updates
* Various minor theme updates
