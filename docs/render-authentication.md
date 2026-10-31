# Render authentication and same-origin hosting

The separate frontend and backend use different origins. The original admin requests selected `credentials: 'same-origin'`, so a response from the other origin could not establish a browser session for those requests. `SameSite=Lax` also excludes cross-site fetch cookies. CORS permission alone does not override either rule. Optimistic login UI previously accepted a successful login response without checking whether the session cookie worked.

The live read-only inspection found that `/api/health` on the frontend domain returned HTML, while the backend allowed the frontend's origin through CORS. No authenticated production requests or database changes were made.

Render's [static-site rewrite documentation](https://render.com/docs/redirects-rewrites) permits full URL destinations but does not specify the authenticated API proxy contract needed here: forwarding POST/PATCH/DELETE bodies, Cookie, and Set-Cookie without redirecting or caching. An existing SPA fallback is not an API proxy. We do not assume that changing it into an external rewrite provides that contract. A dedicated proxy web service would add another component. The smaller supported alternative is to [serve the SPA and API with Express in one Node web service](https://render.com/docs/web-services).

## Proposed changes after explicit deployment approval

Update the existing backend web service, not the static site. The public restaurant and admin URL will become:

`https://family-restaurant-menu.onrender.com`

| Setting | Exact value |
| --- | --- |
| Repository | Existing family-restaurant-menu repository |
| Branch | main, after the reviewed code is approved and pushed |
| Root Directory | Empty |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm run start:server` |
| Health Check Path | `/api/health` |
| NODE_ENV | `production` |
| TRUST_PROXY | `1` |
| SERVE_FRONTEND | `true` |
| CLIENT_ORIGIN | `https://family-restaurant-menu.onrender.com,https://family-restaurant-menu-1.onrender.com` |
| VITE_API_BASE_URL | Remove the old value or leave empty; unified builds force same-origin requests |
| PORT | Let Render supply it |

Keep the existing private `MONGODB_URI` and any existing VAPID/Cloudinary credentials in Render. Do not copy them into the frontend or this document. No database seed, migration, credential change, or admin-account replacement is required. Keep the existing admin account in the current database. The two explicit allowed origins preserve customer API access from the old static site during the transition; remove its origin only after that site is deliberately retired. Admin login should use the new unified origin.

The unified flag makes Express serve the built static assets and SPA deep links after the API routes. Missing API, upload, or asset routes remain real 404s. HTML and the service worker are revalidated; hashed assets can be cached. Image CSP allows HTTPS remote images and local previews while scripts remain restricted to the same origin. Production cookies remain host-only, HttpOnly, Secure, and SameSite=Lax; both issue and logout use the same attributes. All mutating admin requests still require CSRF tokens.

After approval, deploy the reviewed commit and verify the new URL before retiring or otherwise changing the old static site. Open the new origin for both the customer menu and admin. Existing static-site pages cannot acquire this backend's same-origin session automatically. Browser carts, PWA installations and push subscriptions are tied to their original origin; changing the public URL requires customers/admins to reopen it and, where applicable, reinstall or resubscribe. Do not remove the old site as part of this code change.

If keeping the old frontend origin is mandatory, use a real proxy web service with tested forwarding of request methods, bodies, cookies and CSRF headers, or a managed proxy with those documented capabilities. That is a separate deployment choice, not a static SPA rewrite assumption.

## Verification before public use

1. `/api/health` returns JSON successfully.
2. `/admin/login` and `/admin/categories` return the SPA on direct navigation.
3. Login returns a host-only HttpOnly/Secure/SameSite=Lax cookie. `/api/admin/me` succeeds after reload and in a new tab.
4. Categories, products, offers, settings and orders load using relative `/api` requests.
5. Missing/wrong CSRF and unapproved origins are rejected; logout invalidates the server session and clears its cookie.
6. Menu, cart, checkout and order confirmation work on the same public origin.
7. Configure the three server-side Cloudinary settings for production uploads; production does not fall back to local storage. See [image upload and replacement behavior](image-uploads.md). Old local upload links still need their original files or re-uploading.

Run `npm test` and `npm run test:production` locally. The production browser command also builds the frontend, deliberately supplies a stale external API setting to verify the unified override, uses real HTTPS with disposable test certificates, and checks secure cookies and customer checkout against an isolated database.
