# Barcode identity review

NyayaLens decodes supported retail GTIN barcodes from the original inspection photos with ZXing-C++. It checks GTIN length/check digit, keeps leading zeros, and associates each decoded number with its photo. Multiple different barcodes require a selection. If no supported GTIN is decoded, a reviewer can enter printed digits; the saved record identifies this as manual entry.

The website and Expo Results view offer an official Verified by GS1 link and a form for the reviewer to enter the returned GTIN, company/licensee, product and brand. The returned GTIN must match the selected barcode. Do not enter a manufacturer or product name guessed from the package as registry evidence. No registry result is prefilled or fabricated.

Available registry wording is compared with the original saved OCR text using Unicode normalization, case folding, punctuation and whitespace normalization. No fuzzy similarity becomes a match. A missing phrase is **needs review**, since OCR, legal names, brand ownership and manufacturer relationships can differ. Missing product data stays unavailable. A user-reported missing GS1 record is also review, not a counterfeit finding. These results do not change PCR rule results or the original audit PDF.

Comparisons are stored in a separate database table and recovered from the website's officer demo history or the Expo inspection history. Website users can download a separate JSON identity record, including provenance, timestamp, evidence hash and photo text. The normal free-hosting persistence limits apply. Existing demo authentication is unchanged.

## Access checked on 11 September 2026

**Automatic GS1 retrieval is not connected.** The public service supports up to 30 manual queries per day. GS1 says API/batch access requires contacting a GS1 Member Organisation. Public registry APIs are not an unauthenticated integration endpoint; this implementation does not scrape the public lookup or route requests through an unofficial database. The saved `registry_source` is `reviewer_entered` and `api_verified` is always false.

To add automated lookup later, obtain approved GS1 access and the actual account-specific API documentation. That integration will need server-side credentials, documented field mapping, rate limits, response timestamps, permission to retain/display data, and tests for company-only, product, missing, invalid, denied and unavailable responses. No paid resource was created for this feature.

Sources: [GS1 validity lookup guidance](https://support.gs1.org/support/solutions/articles/43000734070/), [Verified by GS1 and API access](https://www.gs1.org/services/verified-by-gs1), [GS1 India validation / DataKart access](https://www.gs1india.org/services/gtin-validation), [ZXing-C++](https://github.com/zxing-cpp/zxing-cpp).

## API and verification

- `GET /api/inspections/{id}/barcode-identity` decodes/caches that inspection's saved photos. A SHA-256 mismatch on initial decoding is rejected. Returns no-store responses.
- `POST /api/inspections/{id}/barcode-identity` validates and saves the explicitly confirmed manual review. API docs expose the input schema.
- `cd backend && ../.venv/bin/python -m unittest test_barcode_identity -v` exercises real decoding in four rotations, valid/invalid numbers, non-GTIN QR rejection, comparison provenance, wrong-GTIN rejection, persistence and photo tampering.
- Browser fixture preparation: import `label` from `backend/test_barcode_identity.py` using the backend on `PYTHONPATH`, and save it as `work/barcode-fixture.png` with OpenCV. Then run `npx playwright test tests/barcode-identity.spec.ts`. The synthetic label and entered registry values are **test fixtures**, not proof of a real GS1 registration.
