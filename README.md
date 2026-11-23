# FarmCart

[![CI](https://github.com/RageSeekerXD/FarmCart/actions/workflows/ci.yml/badge.svg)](https://github.com/RageSeekerXD/FarmCart/actions/workflows/ci.yml)

FarmCart is a marketplace for ordering food from local farms around Lviv, Ukraine. Buyers find seasonal products from
verified farms, pay online or in cash and track their delivery; farmers run their catalogue and orders; couriers deliver
and confirm handover with a code; administrators verify sellers and moderate the platform.

The project is built by a team of two for the course "Software Development Methodologies" (master's programme,
Lviv Polytechnic National University): Extreme Programming with TDD, pair programming and continuous integration.

## Features

- **Buyers:** sign-in with an SMS code, bilingual catalogue (Ukrainian/English) with filters, a map of farms and distance
  search, favourites, product and farm pages with reviews, a cart with products from several farms paid in one checkout,
  delivery slots, promo codes, card / Apple Pay / Google Pay tokens or cash, real-time order tracking, cancellation,
  "order again", rescheduling after a failed delivery, reviews.
- **Farmers:** registration and verification documents, products in two languages with photos and seasonality,
  stock and on-sale toggles, incoming orders (accept, partially accept, reject), picking lists and printable waybills,
  sales analytics.
- **Couriers:** deliveries with contacts and entrance details, a route map, navigation links, handover with a 4-digit
  code, failed-delivery reports.
- **Administrators:** seller verification with document review, delivery slots, promo codes, review moderation,
  audit log.
- **AI features (Claude):** product translation, smart search, review summaries, a product draft from a photo,
  a basket for a recipe, moderation help and a document pre-check - see [AI features](#ai-features).

## Releases

Current version: **2.1.0** (tag `v2.1.0`).

| Version | Date | Content |
|---|---|---|
| 1.0.0 | 2026-10-16 | Core platform: REST API for all four roles, 11 user stories (lab 2, XP) |
| 1.1.0 | 2026-10-31 | Refactoring of release 1.0 under tests, defects DEF-03 and DEF-04 fixed (lab 3) |
| 2.0.0 | 2026-11-12 | Web client for all roles, bilingual catalogue data, real-time notifications (SignalR) |
| 2.1.0 | 2026-11-23 | Storefront and dashboard improvements, multi-farm cart, order cancellation, product photos, AI features |

Details are in [CHANGELOG.md](CHANGELOG.md) (in Ukrainian). The release 2.0 plan is in
[docs/plan-release-2.md](docs/plan-release-2.md); evidence of every lab (TDD cycles, defects, refactoring steps,
CI logs, screenshots) is in [docs/evidence](docs/evidence).

## Tech stack

| Part | Technologies |
|---|---|
| Server | .NET 10, C# 14, ASP.NET Core Minimal API, SignalR, OpenAPI, Anthropic .NET SDK |
| Web client | React 19, TypeScript, Vite, MUI, TanStack Query, react-i18next, react-leaflet (OpenStreetMap) |
| Tests | xUnit, `WebApplicationFactory` acceptance tests, Vitest + Testing Library + MSW, Playwright |
| Quality | `dotnet format`, .NET analyzers (warnings as errors), ESLint, `tsc`, line coverage ≥ 70 %, GitHub Actions |

Storage is in memory with demo data loaded at start-up; SMS, payments and push notifications are test doubles behind
interfaces, so the system runs without external accounts.

## Requirements

- .NET SDK 10.0 (tested with 10.0.401): `dotnet --list-sdks`
- Node.js 22 LTS for the web client
- Windows PowerShell 5.1 or PowerShell 7 for `ci.cmd` and `demo.cmd`

## Getting started

| Task | Command |
|---|---|
| Continuous integration: code style, warning-free build, all .NET and web tests, coverage | `ci.cmd` |
| API with demo data | `dotnet run --project src/FarmCart.Api -c Release`, then http://localhost:5080/api/health |
| Development: API on :5080 and web client on :5173 (Vite proxies `/api`, `/img`, `/hubs`) | the command above plus `npm run dev` in `web/` |
| Production-like: the API serves the built client | `npm run build` in `web/`, then `dotnet run ...` and http://localhost:5080 |
| .NET tests only | `dotnet test -c Release` |
| Web client checks (also run by `ci.cmd`) | `npm run lint`, `npm run typecheck`, `npm run coverage`, `npm run build` in `web/` |
| End-to-end tests (first `dotnet build -c Release`, `npm run build` and once `npx playwright install chromium`) | `npm run e2e` in `web/` |
| Program run log: server with demo data plus the end-to-end demo scenario | `demo.cmd` (output in `docs/protocol`) |
| API types for the client from the OpenAPI schema (server running) | `npm run api:schema` in `web/` |
| Refresh screenshots in `docs/evidence/ui` | `npm run evidence` in `web/` |

If Windows Smart App Control blocks a freshly built DLL (error `0x800711C7`), use the Release configuration
(the scripts already do) or rebuild the solution.

Release 2.1.0 passes CI with 271 unit and 209 acceptance tests (.NET, line coverage 91.5 %), 276 component tests
(Vitest) and 8 end-to-end tests (Playwright).

## Demo accounts (development mode)

| Phone | Role |
|---|---|
| +380500000001 | administrator |
| +380671110001 | farmer, "Зелений Гай" |
| +380671110002 | cheese dairy "Карпатська бринза" |
| +380671110003 | apiary "Медовий шлях" |
| +380671110004 | "Еко-ферма «Сокільники»" (not verified yet) |
| +380631230001 | courier |
| +380931112233 | buyer with history: one order in every status |

In development mode the sign-in page has a "Demo accounts" block for one-click sign-in as a buyer, farmer, courier or
administrator, and the "Switch demo account" button in the header switches between them (`GET /api/demo/accounts`;
the list is empty outside demo mode).

SMS codes are not sent: with `FarmCart:ExposeSmsCodes = true` (`appsettings.Development.json`) `POST /api/auth/code`
returns the code in `devCode`; this setting is rejected in Production. Sandbox payment tokens: `tok_visa`,
`tok_mastercard`, `tok_applepay`, `tok_googlepay` succeed, `tok_declined` is declined by the bank. Promo code `FARM10`
gives 10 % off orders from 300 UAH.

The demo scenario buys only year-round products (carrots, potatoes, honey), so `demo.cmd` passes on any day of the
year. Seasonality is shown by apples (August-March) and strawberries (May-July): the scenario checks the catalogue
against the farmer's seasons for the server's current month (`GET /api/health` returns `time`).

## AI features

All AI features run on the server with Claude (`claude-opus-5-5`) through the official Anthropic SDK. Without an API key
they are hidden and the application works as before. Every reply must match a JSON schema and is checked on the
server; user text is passed as data, never as instructions; paid calls are rate-limited or cached; a person makes
every final decision.

| Feature | Who uses it | How it works |
|---|---|---|
| Product translation | farmer | "Translate" fills the empty language of name, description, composition, shelf life and storage; the farmer reviews before saving; up to 30 requests per hour |
| Farm story translation | farmer | the same button in the farm profile |
| Smart search | signed-in buyer | a request in plain words ("cheap certified honey within 20 km") becomes ordinary catalogue filters that the buyer can change; up to 60 requests per hour |
| Review summary | everyone | from 3 written reviews; cached until the reviews change |
| Product draft from a photo | farmer | fills only an empty name, category and description; the photo is not stored; up to 20 requests per hour |
| Basket for a recipe | signed-in buyer | only products in stock, never more than the stock; the buyer adds them to the cart; up to 20 requests per hour |
| Moderation help | administrator | flags suspicious reviews with a reason; the administrator decides; up to 20 checks per hour |
| Document pre-check | administrator | the document goes to the AI only on request, the action is written to the audit log; the administrator decides |

**Frequently bought together** on the product page and in the cart counts products from the same purchases.
It does not use AI, so it works without a key.

| Mode | How to enable |
|---|---|
| Real AI (paid) | set the `ANTHROPIC_API_KEY` environment variable on the server; never put the key in `appsettings` or the repository |
| Simulation without a key or costs (development only) | `dotnet run --project src/FarmCart.Api -c Release -- --FarmCart:FakeAi=true` |

So far the Claude calls have been tested only against stubbed HTTP responses; they have not yet run with a real key.

## Solution structure

| Path | Purpose |
|---|---|
| `src/FarmCart.Core` | Domain logic: user-story services, AI services, in-memory store, test doubles of external services |
| `src/FarmCart.Api` | ASP.NET Core Minimal API, SignalR hub, middleware (request log, errors, card-number guard), Claude clients, demo data |
| `web/` | React web client for all four roles, component and end-to-end tests |
| `tests/FarmCart.Core.Tests` | Unit tests (xUnit), written test-first |
| `tests/FarmCart.AcceptanceTests` | Customer acceptance tests over the HTTP API (`WebApplicationFactory`), one class per story; the demo scenario for every month of the year |
| `tools/FarmCart.Demo` | Demo client that walks through the release scenario and prints a run log |
| `ci.ps1` / `ci.cmd` | Continuous integration script |
| `demo.ps1` / `demo.cmd` | Produces the program run log |
| `coverage.runsettings` | Microsoft Code Coverage with dynamic instrumentation |
| `docs/` | Release plan, run logs and evidence of each lab |

## Main API routes

| Method and path | Story | Caller |
|---|---|---|
| `POST /api/auth/code`, `POST /api/auth/verify` | US-01 | everyone |
| `POST /api/farmers`, `GET/POST /api/farmer/products`, `PATCH /api/farmer/products/{id}` | US-02, US-03 | farmer |
| `GET /api/catalog?category=&certified=&lat=&lon=&maxKm=&minPrice=&maxPrice=&sort=&lang=` | US-04 | buyer |
| `GET /api/farmers` - verified farms for the map; `GET /api/reference` - category and unit codes | BE-1, BE-9 | everyone |
| `GET /api/cart`, `POST /api/cart/items`, `GET /api/slots`, `POST /api/orders` (`Idempotency-Key`) - a cart from any farms, one order per farm | US-05, US-06 | buyer |
| `POST /api/orders/{id}/cancel` - cancel until the farmer accepts the order | CANCEL | buyer |
| `POST /api/orders/{id}/reorder` - order again; `POST /api/orders/{id}/reschedule` - new slot after a failed delivery | REORDER, DLV | buyer |
| `GET /api/farmer/orders`, `POST /api/farmer/orders/{id}/accept`, `.../reject` | US-07 | farmer |
| `.../assemble`, `.../handover`, `GET /api/me/notifications`, hub `/hubs/notifications` | US-08 | farmer, buyer |
| `GET /api/courier/deliveries`, `POST /api/courier/deliveries/{id}/confirm`, `.../fail` | US-09, DLV | courier |
| `POST /api/orders/{id}/review`, `GET /api/farmers/{id}/reviews`, `GET /api/products/{id}/reviews` | US-10 | buyer |
| `PUT/DELETE /api/farmer/products/{id}/photo` (JPEG/PNG/WebP up to 2 MB), `POST /api/farmer/reapply`; photos at `GET /img/products/{id}` | PHOTO, ADM | farmer |
| `GET /api/admin/farmers/pending`, `POST /api/admin/farmers/{id}/reject`, `GET /api/admin/audit` | US-02, ADM | administrator |
| `PATCH/DELETE /api/admin/slots/{id}`, `POST /api/admin/promocodes/{code}/activate`, `.../deactivate` | ADM | administrator |
| `GET /api/admin/reviews`, `POST /api/admin/reviews/{id}/hide`, `.../restore` | REV | administrator |
| `GET/POST /api/farmer/products/translation` - product translation | AI-1 | farmer |
| `GET/POST /api/catalog/smart-search` - smart search (`POST` after sign-in) | AI-3 | buyer |
| `GET /api/ai/status`, `GET /api/farmers/{id}/reviews/summary`, `GET /api/products/{id}/reviews/summary` | AI-5 | everyone |
| `POST /api/farmer/products/suggestion` (body: photo) - product draft | AI-6 | farmer |
| `POST /api/catalog/basket-plan` - basket for a recipe; `GET /api/catalog/related?ids=` - frequently bought together | AI-7, REL | buyer |
| `POST /api/admin/reviews/check`, `POST /api/admin/farmers/{id}/documents/{documentId}/check` | AI-8, AI-9 | administrator |

## Bilingual data

Since 2.0 product, unit and farm names are objects `{ "uk": "...", "en": "..." }`; category and unit are codes from
`GET /api/reference` (`vegetables`, `kg`, ...). Data managed by the system is translated; text written by users
(reviews, comments, addresses, rejection reasons) is shown as entered. API error messages stay in Ukrainian, and the
client translates an error by its code (`error`).

## Limitations

- In-memory storage: after a restart only the demo data remains.
- SMS, payments and push notifications are test doubles; real providers are planned for release 3.0.
- Support contacts in the footer are placeholders (`support@farmcart.example`).
- Address suggestions use the Photon geocoder (OpenStreetMap): only the typed address text is sent, from three characters.

## Course labs

| Lab | Topic | Result |
|---|---|---|
| 1 | Choosing a development methodology for different classes and types of projects | requirements for FarmCart and a scored comparison of methodologies |
| 2 | Team development with Extreme Programming | release 1.0: planning game, TDD, pair programming, CI |
| 3 | Refactoring the developed code | release 1.1: code metrics, 9 refactorings, 2 defects fixed; then releases 2.0.0 (web client) and 2.1.0 (storefront, dashboards, AI features) |
| 4 | Project management with Atlassian Jira and Redmine | the whole project history tracked in both tools and compared |
