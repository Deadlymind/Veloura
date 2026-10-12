# Veloura

A responsive cosmetics storefront built with **Django 5.2 + Django REST Framework** and **Next.js 16 + React 19 + TypeScript + Tailwind CSS 4**. The catalog is served by Django; there is no frontend mock catalog.

## Local setup

Requirements: Python 3.12+ and Node.js 20.9+ (Node 22 recommended). SQLite is included with Python. No external services or API keys are needed.

From the repository root, in PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

Set `DJANGO_SECRET_KEY` in `backend/.env` to a random local secret. Generate one with:

```powershell
.\.venv\Scripts\python.exe -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Initialize the database and create the sample catalog:

```powershell
Set-Location backend
..\.venv\Scripts\python.exe manage.py migrate
..\.venv\Scripts\python.exe manage.py seed_demo
..\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

In a second terminal:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:3000**. The API is at **http://127.0.0.1:8000/api/**.

On macOS/Linux use `python3 -m venv .venv`, `.venv/bin/python`, and `cp` in place of the Windows equivalents. `requirements.lock` includes the versions verified for local development; use `requirements.txt` for supported dependency ranges and the Linux production server dependency.

For this prepared workspace, dependencies, migrations and demo data have already been installed. Run the two server commands above, or run `./start-local.ps1` from the project root to start both in the background. Use `./stop-local.ps1` to stop servers started by that script.

## Share locally with Cloudflare Tunnel

From the project root in PowerShell, run `./start-tunnel.ps1`. This starts a temporary Cloudflare Quick Tunnel to the Next.js server on port 3000 and prints its public HTTPS URL. The first run downloads the official Windows x64 `cloudflared` release and verifies its release checksum. No Cloudflare account or domain is required.

The launcher restarts the local servers to enable checkout and admin CSRF checks for that exact tunnel origin. Django stays on loopback port 8000; browser API calls and uploaded images pass through Next.js. The public URL includes the storefront and password-protected custom admin dashboard at `/admin/login`. Existing local URLs continue to work.

Run `./stop-tunnel.ps1` to close public access and remove the temporary trusted origin. Local servers remain running. Keep the computer awake and online while sharing. Each new tunnel receives a new address; this is a temporary preview, not persistent hosting. Runtime state and the downloaded binary are ignored by Git. See [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) for service limitations.

## Storefront routes

The storefront includes these page types:

- `/` — editorial home, categories, selected favorites, story and new arrivals.
- `/category/[slug]` — shared category, collection and search template. `all`, `skincare`, `makeup`, `haircare`, and `body-care` are seeded.
- `/products/[slug]` — gallery, product details, variant selection, purchase controls and related products.
- `/checkout` — contact and delivery details, live bag review and unpaid order submission for manual confirmation.

Examples: `/category/all?search=serum`, `/category/all?featured=true`, `/category/all?is_new=true`, `/category/skincare?availability=in-stock&ordering=price`.

The bag is a modal drawer available on every page. It stores only product/variant IDs and quantities in local storage. Django calculates prices, stock limits, line totals and subtotal. Revalidation occurs on initial load, opening the bag, every mutation, tab focus while open, and cross-tab storage changes. Unavailable lines show a reason and are excluded from the subtotal. Changed prices produce a notice. Items are not reserved. Checkout at `/checkout` submits unpaid order requests for manual confirmation. Online payments and customer accounts are not included.

## Staff dashboard

Open **http://127.0.0.1:3000/admin** for the dedicated Veloura workspace. It has its own responsive sidebar and layout, separate from the storefront.

The prepared local workspace has an administrator named **veloura-admin**. Its generated password is in the gitignored `dashboard-access.txt` file in the project root. Keep that file private. No fixed default password or public signup endpoint exists.

For a fresh installation, create an account after migrating:

```powershell
Set-Location backend
..\.venv\Scripts\python.exe manage.py create_dashboard_staff --username your-name --role administrator --credentials-file ../dashboard-access.txt
```

The command creates the role groups and their model permissions, refuses to overwrite an existing account or credential file, hashes the password in Django, and writes the generated login details only to the requested local file. Use `--role editor` for a Catalog Editor. An existing Django superuser can also sign in.

Dashboard sections:

- **Overview**: live product/category counts, published/featured totals, low-stock and out-of-stock alerts per product or variant, incomplete content, and recent activity.
- **Products**: search, sorting, pagination, category/status/demo/stock filters, product creation/editing/deletion, publishing, editorial flags, previewing unsaved fields, and opening published storefront pages.
- **Product imagery**: multiple JPEG/PNG/WebP uploads with progress, required alt text, cover ordering with accessible move buttons, and removal. Each file is limited to 10 MB.
- **Variants**: shades, six-digit swatch colors, sizes, unique SKUs, optional price overrides, and stock. Variant stock takes precedence over parent stock.
- **Categories**: names, slugs, introductions, image uploads/URLs, and display order. Categories containing products cannot be deleted.
- **Inventory**: separate rows for variants, search and stock filters, quick quantity updates. The API checks the last-seen stock and returns a conflict if someone else has changed it.
- **Store settings**: currency, locale, contact/social links, logo selection/upload, and low-stock threshold. Currency changes require confirmation and do not convert prices. Clearing the logo restores the preferred text wordmark.
- **Activity log**: read-only actor, timestamp, changed fields, and before/after values. Catalog changes made through either the dashboard or Django Admin are recorded. Management-command changes are labeled System.
- **Team access**: administrators can create staff, assign roles, reset another account's password, and deactivate access. Your own access cannot be removed from this screen. Owner/superuser accounts are managed through Django Admin.

**Administrators** manage catalog content, settings and staff access. **Catalog Editors** manage catalog content and inventory, and can read settings and activity. Backend model permissions apply to direct API requests as well as the UI. Staff without catalog permissions cannot enter the dashboard.

To reset an existing password locally:

```powershell
Set-Location backend
..\.venv\Scripts\python.exe manage.py changepassword veloura-admin
```

Staff authentication uses Django sessions with an eight-hour expiry, HttpOnly session cookies, CSRF protection (including login), and login throttling. Browser requests use `/api/staff/...`; the bounded Next proxy forwards session/CSRF cookies and the original origin to Django. Add your actual frontend origin to `CSRF_TRUSTED_ORIGINS` for other hosts. Secure cookies are enabled when Django debug mode is off. Place rate limiting at the reverse proxy for production; the application throttle sees the Next server's address.

## Django Admin fallback

```powershell
Set-Location backend
..\.venv\Scripts\python.exe manage.py createsuperuser
```

Visit **http://127.0.0.1:8000/admin/**. Use the account you created; no fixed default credentials are supplied.

Products support multiple uploaded images (with required alt text), category, slug, description, decimal price, stock, product type, ingredients, usage, details, featured/new/active/demo flags, and inline variants. Variants have a SKU, shade/color or size, price override, and stock. **When variants exist, their stock takes precedence over the parent stock.** The card price and price filters use the lowest variant price. Product type is the category-aware attribute filter.

Upload images through the Product images inline. Uploaded files are served through the frontend's `/media/` rewrite; local development Django serves them in debug mode. For production, use persistent media storage and a web server/CDN. Local `/images/...` paths and HTTPS image URLs are also supported. Remote image hosts must be explicitly added to `frontend/next.config.ts` for Next Image optimization; the demo uses local generated assets. Uploads are limited to 10 MB and validated as images. PNG, JPEG and WebP are suitable choices.

`seed_demo` is repeatable without duplication and leaves non-demo products untouched. It refreshes seeded demo products; do not use it to maintain a real catalog. The seed creates four categories, twelve products, shade/size examples and out-of-stock examples. All prices, names, quantities and generated packaging are **illustrative demo data**, not product claims. Ingredients and usage deliberately contain honest demo notices rather than fabricated formulations. Replace them with verified supplier information before real use. “Our favorites” is an editorial selection, not a claim about sales figures.

## Branding and settings

- Palette and responsive layout: `frontend/src/app/globals.css`.
- Serif: Cormorant Garamond. Sans: DM Sans. Fonts load from Google Fonts with local Georgia/Arial fallbacks; self-host them if needed for offline use.
- The storefront header/footer and custom admin share the logo configured under **Store settings**. The supplied transparent emblem is bundled unchanged at `frontend/public/images/veloura-logo.png`; set the logo URL to `/images/veloura-logo.png` to select it. Selecting “Use the text wordmark” clears the image selection. Django Admin also displays the bundled emblem. The earlier JPEG is retained for reference.
- Manage currency and locale under **Store settings**, e.g. `NGN` and `en-NG`. Use a currency recognized by JavaScript Intl. Changing currency does not convert catalog prices; update numeric prices accordingly.
- Manage real contact and social destinations under **Store settings**. Empty settings hide these links; no invented contact details are displayed.
- `STORE_*` environment values initialize the settings database row on first use. Once initialized, database settings are authoritative; changing these environment defaults does not overwrite dashboard changes. Secrets, allowed hosts, trusted origins and database connections remain environment-only.
- Backend origin: `DJANGO_API_URL` in `frontend/.env.local`. This is server-only. Browser traffic uses a bounded same-origin Next API proxy, so the internal backend origin is not exposed as a client setting.
- Public site origin for metadata: `NEXT_PUBLIC_SITE_URL`.
- Restart the appropriate server after changing environment variables.

The hero and product photography are AI-generated concept assets. See `ASSETS.md` for their generation briefs and paths. They are part of this repository and need no external image service.

## API

Catalog endpoints are public and read-only. Management is restricted to authenticated Django Admin.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/config/` | Currency, locale, logo, contact links, demo status, attribute facets |
| `GET /api/categories/` | Ordered categories |
| `GET /api/products/` | Filtered, sorted, paginated active products |
| `GET /api/products/{slug}/` | Product with images and variants |
| `POST /api/bag/validate/` | Validate IDs/quantities and calculate authoritative totals |

Product query parameters: `category`, `search`, `min_price`, `max_price`, `availability=in-stock|out-of-stock`, `attribute`, `featured=true|false`, `is_new=true|false`, `ordering=newest|price|-price`, `page`, `page_size` (default 8, max 48). Monetary boundaries and sorting use the lowest displayed variant price. Secondary ordering by ID is deterministic.

Example bag request:

```json
{"items":[{"product_id":1,"variant_id":null,"quantity":2}]}
```

Use real IDs from the catalog. Maximum 100 unique lines, quantity 1–99 per line. Duplicate lines, malformed IDs and invalid quantities return 400. Removed products, mismatched variants and insufficient stock return a helpful line message with the currently allowed quantity. Monetary values are decimal strings. Invalid product filters return 400; missing products and out-of-range pages return 404.

## Verification

```powershell
Set-Location backend
..\.venv\Scripts\python.exe manage.py check
..\.venv\Scripts\python.exe manage.py test catalog
Set-Location ../frontend
npm run typecheck
npm run build
```

Browser tests require both servers running on ports 8000 and 3000 and the demo data. Tests use installed Microsoft Edge by default:

```powershell
npm run test:e2e
```

The backend test suite includes storefront and staff API coverage. Browser tests include storefront flows plus staff authentication, product creation, image uploads/order, variant editing, publication, inventory updates, protected categories, settings, and dashboard accessibility. Staff browser tests use `dashboard-access.txt` or `VELOURA_TEST_USERNAME` / `VELOURA_TEST_PASSWORD` environment variables and skip when no account is provided. They create temporary QA products/categories and remove them afterward; their audit entries remain as an honest history. Use a development database for these tests.

For Linux/macOS without Edge, run `npx playwright install chromium` and remove `channel: 'msedge'` from `playwright.config.ts`. Tests cover persisted bag mutations, backend error recovery, URL filters/sort/pagination, search empty states, variant prices/availability, gallery/accordions, mobile drawers and overflow. Backend tests cover price/stock reconciliation, removed products, invalid data, variants, filtering, pagination, currency and seeding. Screenshots are written to `frontend/test-results/`.

## Production notes

This delivery is a local, working storefront; no hosting or external deployment has been configured. Use `npm run build` then `npm run start` for the Next production server. On Linux, use a WSGI server (e.g. `gunicorn config.wsgi`) for Django, install from `requirements.txt`, and run `collectstatic`. The included `start` script binds Next to loopback for local review; configure binding/reverse proxy for your deployment.

Use a new secret, `DJANGO_DEBUG=False`, explicit allowed hosts, trusted HTTPS origins, PostgreSQL via `DATABASE_URL` if desired, HTTPS termination, persistent media storage, and static asset serving. Secure session/CSRF cookies are enabled when debug is off. Django's public throttle is an application safeguard, not a substitute for edge rate limiting. Checkout submissions are transactional. Stock is reserved only when an administrator confirms a request, and cancellation releases it. Use PostgreSQL for a production store with concurrent inventory updates.


## English and French

Use the **EN / FR** selector in the storefront header, dashboard header, or staff login page. The choice is remembered for one year using the `django_language` cookie and applies to both interfaces. Switching preserves the current URL, filters, shopping bag and unsaved dashboard fields. English remains the default. French pages render on the server with `lang="fr"`, translated metadata, accessible labels and French number/date formatting; changing language never converts prices or changes the store currency.

In product and category editors, expand **French translations** to enter French content. Variants have the same section; image cards have a French alternative-text field. Base catalog fields remain English. Empty French fields fall back to their English value. URLs, SKUs, product IDs, stock and publishing status are shared. Public APIs localize using `Accept-Language: fr` or the language cookie; staff APIs keep editable English fields alongside `translations.fr`. Attribute filters retain stable English values and expose translated display labels. Search includes French product and category names and product descriptions.

Migration `0003` adds validated translation fields. `seed_demo` includes French example content. On an existing database, add only missing French demo translations without resetting inventory or publishing status:

```powershell
.\.venv\Scripts\python.exe backend\manage.py migrate
.\.venv\Scripts\python.exe backend\manage.py seed_french
```

UI translations live in `frontend/src/lib/messages/fr.json`. Backend custom validation messages live in `backend/catalog/french_errors.json`; Django and DRF also use their built-in French translations. The Django Admin language selector shares the same cookie. The logo is kept unchanged in both languages.

Localization checks: `python manage.py test catalog.test_localization` from `backend`, and `npx playwright test french.spec.ts` from `frontend` (using the local staff credentials described above). Browser tests create and remove their own bilingual sample records; their audit history remains.


## Checkout and unpaid orders

The bag now links to `/checkout`. Customers provide contact and delivery details, review the current product subtotal, and explicitly acknowledge that the request is unpaid and subject to manual confirmation. No shipping rate, tax rate or final payable total is invented: delivery charges and any taxes are confirmed directly with the customer before payment. No card details are collected and no automatic messages or emails are sent.

- `GET /api/checkout/` issues a CSRF token; `POST /api/checkout/` validates contact fields, product IDs, variants, quantities, expected unit prices and currency. A price or availability change returns HTTP 409 for customer review. Submission is throttled to 20 attempts per hour per IP in Django’s cache.
- Requests store immutable line snapshots and a random reference. A UUID idempotency key plus payload hash makes exact network retries return the same request. A changed payload using the same key is rejected. The public receipt excludes customer information; there is no public order lookup.
- Orders begin as **Pending confirmation** without reserving stock. In **Admin → Orders**, administrators can review customer details and confirm or cancel. Confirmation atomically checks and deducts inventory across all lines. Insufficient stock rolls the whole confirmation back. Cancelling a confirmed order releases stock exactly once. Cancelled orders cannot be reopened. Every status remains unpaid; payment tracking and fulfilment are outside this change.
- Catalog Editors cannot access customer orders. Django Admin provides a read-only order record plus controlled confirm/cancel actions. Order lines survive catalog deletion. The activity log records status changes without copying customer contact information into the general catalog audit.
- Demo products create clearly marked demo requests. Existing product prices, publishing status and inventory are preserved during installation. Migration `0004` adds orders and order items. On an existing install, run `python manage.py migrate` and `python manage.py shell -c "from catalog.staff_views import ensure_roles; ensure_roles()"` from `backend` to refresh administrator permissions.
- Checkout works in English and French. Contact data is not persisted in browser storage. Only a retry key and request hash are temporarily retained in session storage; the bag still contains only product IDs and quantities.

Tests: `python manage.py test catalog.test_checkout` covers validation, request deduplication, CSRF, role restrictions, price conflicts, stock reservation and rollback. From `frontend`, run `npx playwright test checkout.spec.ts` for the English/French customer flow, mobile layout, accessibility and admin confirmation/cancellation. Test orders contain `qa-checkout@example.test` and are cancelled; they are not real customer orders.
