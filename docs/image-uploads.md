# Durable catalog images

Production image uploads require private `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` settings on the backend. Obtain them from the Cloudinary account's API Keys settings. Keep all three on the server; never use frontend-prefixed environment variables for them. Missing, partial, or failing Cloudinary configuration returns a clear upload error. It never silently writes a production upload to Render's ephemeral filesystem.

Development without any Cloudinary settings keeps the existing local `/uploads/img-...` fallback. Existing `/images` stock assets and old `/uploads` database links remain readable where their files still exist. Lost files from an earlier ephemeral deployment cannot be recovered from a URL: re-upload those images through admin. No production data migration or seed script is required or run by this change.

## Save and replace

1. The existing uploader sends the actual selected JPEG, PNG, or WebP bytes to the authenticated backend. The local preview is temporary; saving stays disabled while uploading.
2. The backend validates size/type and performs a signed Cloudinary upload with a fresh public ID and overwriting disabled.
3. It returns the final versioned HTTPS URL, public ID, version, and a short-lived signed upload receipt bound to the admin. The receipt prevents arbitrary image metadata from authorizing deletion of another asset. It is not a session token and is not persisted in browser storage or the catalog record.
4. Saving a product, category, or offer persists `imageUrl`, `imagePublicId`, and `imageVersion`. The legacy `image` field remains synchronized for compatibility. Both public and admin responses use the same canonical URL.
5. The old image is queued for deletion, but deletion is allowed only after MongoDB no longer references it. Failed saves preserve the old record and image. Shared catalog images and order-history snapshots keep their referenced assets.
6. The backend requests Cloudinary deletion with CDN invalidation. A durable MongoDB cleanup job retries provider failures after restart. The regular server starts this worker; browser/unit tests use isolated storage and explicit cleanup calls.

Each replacement has a different public ID and a versioned URL, so browsers and Cloudinary do not need to reuse the previous image cache. Cloudinary CDN invalidation itself can take time; showing the new URL does not wait for invalidation of the old URL.

Offers without a custom photo inherit the product's current image instead of copying its URL at creation. When a product photo changes, legacy offers that copied that exact URL without their own image ownership metadata are switched back to inheritance. Offers with a separate custom image keep their own photo.

Product/category PATCH validation keeps only explicitly supplied fields. Defaults in the former partial schemas could introduce an empty image or reset flags during an availability-only toggle; those omitted fields now retain their saved values.

## Menu synchronization

Successful admin catalog mutations invalidate the module cache and notify the active MenuContext. A storage revision signal also refreshes other tabs at the same origin. Older in-flight responses cannot overwrite newly fetched menu data. Public catalog API responses are marked `no-store`; the Service Worker leaves API, legacy upload and external-provider image requests to the browser network stack. A different device sees current data on its next refresh or focus.

No CSS classes, layout, or customer order/pricing behavior is changed. Production tests use an in-process Cloudinary API double with validated request signatures and mocked delivery responses, plus a fresh local MongoMemoryServer. They do not upload to a real Cloudinary account or modify Atlas.

Run `npm test` and `npm run test:production`. The browser suite covers repeated product uploads from phone, iPad, and desktop viewports; category and offer images; an already-open public tab; and failed/in-progress uploads.

Production activation still requires adding the three private Cloudinary settings and deploying the reviewed code. Do not treat passing the mocked provider tests as evidence that a real account has been configured.

## Files changed

- `README.md`
- `docs/image-uploads.md`
- `docs/render-authentication.md`
- `public/sw.js`
- `scripts/test-ui.mjs`
- `server/.env.example`
- `server/src/app.js`
- `server/src/config/env.js`
- `server/src/models/index.js`
- `server/src/services/imageService.js`
- `server/src/services/menuService.js`
- `server/src/services/repository.js`
- `server/src/services/uploadService.js`
- `server/src/start.js`
- `server/src/utils/images.js`
- `server/src/validators/adminCategory.js`
- `server/src/validators/adminOffer.js`
- `server/src/validators/adminProduct.js`
- `server/src/validators/image.js`
- `server/tests/adminOffersSettings.test.js`
- `server/tests/imageUploads.test.js`
- `server/tests/uploadService.test.js`
- `src/components/admin/common/ImageUploader.jsx`
- `src/context/MenuContext.jsx`
- `src/pages/admin/categories/CategoryFormPage.jsx`
- `src/pages/admin/offers/OfferFormPage.jsx`
- `src/pages/admin/offers/OffersListPage.jsx`
- `src/pages/admin/products/ProductFormPage.jsx`
- `src/services/adminCatalogService.js`
- `src/services/adminOffersService.js`
- `src/services/apiClient.js`
- `src/services/menuService.js`
- `src/services/storeService.js`
- `src/utils/images.js`
- `tests/browser/imageUploads.spec.js`
- `tests/helpers/cloudinary.js`
- `tests/imageCaching.test.js`
- `tests/menuService.test.js`
