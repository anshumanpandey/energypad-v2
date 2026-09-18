# Legacy feature inventory

Discovery snapshot: 17 September 2026. Status: repository discovery completed for review; production behaviour and workbook approval remain unverified. This is Sprint 0 documentation only.

## Sources and coverage

- Root API revision: `926702eb0eccfdf443085f58d347688ef520d2fb`.
- Nested Energiepad revision: `6aca4341153011e157ec8a67f1b5d6395cefd25d`.
- Root API is Express/TypeScript/Knex with PostgreSQL configuration. Nested API is Express/TypeScript/Sequelize/MySQL. UI is React 17/CRA/Router 5/Redux/Bootstrap.
- Inspected the working tree, including existing changes in dashboard.service.ts and test configuration. Nested JS copies are mostly untracked generated siblings. They were indexed separately and not deleted. Production source revision, database version and equivalence to the referenced ZIP require owner confirmation.
- Static TypeScript AST inventory covers all 564 JS/TS source and migration files under root src/, root migrations/, nested UI src/ and nested API src/. Tables below enumerate declared routes, UI requests, domain contracts and source modules. Comments are excluded from AST call counts. Third-party dependencies, assets and generated builds are excluded.
- Catalogued 27 active UI routes, 47 root API endpoints, 19 nested API endpoints and 53 canonical UI request/configuration expressions, plus the dynamic import modal bindings. The migration map covers 30 surviving source-derived tables and 174 fields.
- No production network calls, database migrations, fixture edits or application changes were performed. Source findings are not claims of a successfully reproduced production exploit or live feature.
- No repository AGENTS.md was found. Source precedence for decisions: approved V2 requirements, approved calculation fixtures, legacy code, then legacy tests/history.

## Screens and navigation

Every active route declaration in the TSX App is listed below. “PrivateRoute” is a client token-presence wrapper, not proof of server authorization. Route casing is preserved. Shared components are indexed later.

| Legacy path | Wrapper | Disposition | V2 destination | Sprint | Evidence |
| --- | --- | --- | --- | --- | --- |
| / | Route | Retire (proposed from SaaS shell) | Marketing content outside authenticated app | 1 | [Energiepad/energiepadui/src/App.tsx:37](../Energiepad/energiepadui/src/App.tsx#L37) |
| /home | Route | Retire (proposed from SaaS shell) | Marketing content outside authenticated app | 1 | [Energiepad/energiepadui/src/App.tsx:42](../Energiepad/energiepadui/src/App.tsx#L42) |
| /About | Route | Retire (proposed from SaaS shell) | Marketing content outside authenticated app | 1 | [Energiepad/energiepadui/src/App.tsx:47](../Energiepad/energiepadui/src/App.tsx#L47) |
| /Recognitions | Route | Retire (proposed from SaaS shell) | Marketing content outside authenticated app | 1 | [Energiepad/energiepadui/src/App.tsx:52](../Energiepad/energiepadui/src/App.tsx#L52) |
| /Work | Route | Retire (proposed from SaaS shell) | Marketing content outside authenticated app | 1 | [Energiepad/energiepadui/src/App.tsx:57](../Energiepad/energiepadui/src/App.tsx#L57) |
| /Progress | Route | Retire (proposed from SaaS shell) | Marketing content outside authenticated app | 1 | [Energiepad/energiepadui/src/App.tsx:58](../Energiepad/energiepadui/src/App.tsx#L58) |
| /Team | Route | Retire (proposed from SaaS shell) | Marketing content outside authenticated app | 1 | [Energiepad/energiepadui/src/App.tsx:59](../Energiepad/energiepadui/src/App.tsx#L59) |
| /Blog | Route | Retire (proposed from SaaS shell) | Marketing content outside authenticated app | 1 | [Energiepad/energiepadui/src/App.tsx:60](../Energiepad/energiepadui/src/App.tsx#L60) |
| /Gallery | Route | Retire (proposed from SaaS shell) | Marketing content outside authenticated app | 1 | [Energiepad/energiepadui/src/App.tsx:61](../Energiepad/energiepadui/src/App.tsx#L61) |
| /Contact | Route | Retire (proposed from SaaS shell) | Marketing content outside authenticated app | 1 | [Energiepad/energiepadui/src/App.tsx:62](../Energiepad/energiepadui/src/App.tsx#L62) |
| /home/Settings | Route | Replace | Application shell and shared UI | 1 | [Energiepad/energiepadui/src/App.tsx:63](../Energiepad/energiepadui/src/App.tsx#L63) |
| /home/settings/business | Route | Redesign | Organisation and onboarding | 1–2 | [Energiepad/energiepadui/src/App.tsx:69](../Energiepad/energiepadui/src/App.tsx#L69) |
| /home/settings/building-energy-patterns | PrivateRoute | Redesign | Drivers and operating history | 3 | [Energiepad/energiepadui/src/App.tsx:75](../Energiepad/energiepadui/src/App.tsx#L75) |
| /home/settings/utilityandemissions | PrivateRoute | Redesign | Energy, Carbon and targets | 3, 5 | [Energiepad/energiepadui/src/App.tsx:81](../Energiepad/energiepadui/src/App.tsx#L81) |
| /home/settings/buildingenergylog | PrivateRoute | Redesign | Drivers and operating history | 3 | [Energiepad/energiepadui/src/App.tsx:87](../Energiepad/energiepadui/src/App.tsx#L87) |
| /home/settings/reviewandprogrammes | PrivateRoute | Redesign | Opportunities and evidence | 6 | [Energiepad/energiepadui/src/App.tsx:93](../Energiepad/energiepadui/src/App.tsx#L93) |
| /home/settings/sites | PrivateRoute | Retain | Sites and meters | 2 | [Energiepad/energiepadui/src/App.tsx:99](../Energiepad/energiepadui/src/App.tsx#L99) |
| /home/analytics | PrivateRoute | Redesign | Overview and analytics navigation | 5 | [Energiepad/energiepadui/src/App.tsx:105](../Energiepad/energiepadui/src/App.tsx#L105) |
| /home/user-management | PrivateRoute | Redesign | Identity and organisation services | 1–2 | [Energiepad/energiepadui/src/App.tsx:111](../Energiepad/energiepadui/src/App.tsx#L111) |
| /analytics/utilityleague | PrivateRoute | Redesign | Overview and site performance | 5 | [Energiepad/energiepadui/src/App.tsx:117](../Energiepad/energiepadui/src/App.tsx#L117) |
| /analytics/carbonfootprints | PrivateRoute | Redesign | Carbon | 5 | [Energiepad/energiepadui/src/App.tsx:121](../Energiepad/energiepadui/src/App.tsx#L121) |
| /analytics/energywaste | Route | Redesign | Baseline and Waste & Savings | 4–5 | [Energiepad/energiepadui/src/App.tsx:125](../Energiepad/energiepadui/src/App.tsx#L125) |
| /analytics/energysavingtips | Route | Redesign | Opportunities and evidence | 6 | [Energiepad/energiepadui/src/App.tsx:126](../Energiepad/energiepadui/src/App.tsx#L126) |
| /analytics/reports | Route | Redesign | Reports | 5, 7 | [Energiepad/energiepadui/src/App.tsx:130](../Energiepad/energiepadui/src/App.tsx#L130) |
| /analytics/energylog | Route | Redesign | Drivers and operating history | 3 | [Energiepad/energiepadui/src/App.tsx:131](../Energiepad/energiepadui/src/App.tsx#L131) |
| /analytics/Portfolio | Route | Redesign | Overview and site performance | 5 | [Energiepad/energiepadui/src/App.tsx:132](../Energiepad/energiepadui/src/App.tsx#L132) |
| /login | Route | Replace | Identity and memberships | 1 | [Energiepad/energiepadui/src/App.tsx:133](../Energiepad/energiepadui/src/App.tsx#L133) |

Observed screen details:

- Settings is a navigation/import hub. Business edits account/contact/address/currency details. Sites edits site data and fuel/end-use configuration. Utility & Emissions exposes consumption, emission factors and monitoring/target entry, including “all months” expansion.
- Building Energy Patterns stores date ranges, days/year, set point and end-use. Building Energy Log displays operations and building users, but its submit handler currently logs values rather than calling the save API. Preserve the domain, not that incomplete save behaviour.
- Review & Programmes records questionnaire answers. User Management is a monthly-reads/site-list shell, not an implemented membership/role administration system.
- Analytics links to Utility League, Carbon Footprints, Energy Waste, Energy Saving Tips, Reports, Energy Log and Portfolio. Energy Load, Load Costs and Behaviour Change cards point to `#`; classify them as placeholders, not delivered production capabilities.
- Site Performance should retain consumption/cost/target comparisons, fuel/year/month/site filters and trend/ranking concepts. Waste & Savings retains actual/expected, signs, significance and evidence; Carbon retains trends and factor provenance; Reports replaces browser-only output with versioned exports.
- Existing chart families include line, grouped/stacked/diverging bars, thermometer and pies, plus chart PNG export and HTML-to-image hook. Preserve useful comparisons; retire individual visual variants unless they serve the redesigned decision flow.
- Duplicate JS/TS source resolution is a reference risk. The inventory uses TS/TSX as readable source when both exist; it does not certify which sibling the production bundle loaded.

## Root API route catalogue

Root routes mount at `/api` in src/app.ts. JWT below means the route declares AuthMiddleware, not that object ownership is checked. Dispositions replace legacy HTTP contracts with versioned `/api/v1` services while retaining the mapped capability.

| Endpoint | Authentication | Handler | V2 module / sprint | Evidence |
| --- | --- | --- | --- | --- |
| POST /api/auth/ | No route auth | AuthController.registerUser | Identity and memberships / 1 | [src/routes/v1/auth.route.ts:8](../src/routes/v1/auth.route.ts#L8) |
| POST /api/auth/login | No route auth | AuthController.loginUser | Identity and memberships / 1 | [src/routes/v1/auth.route.ts:17](../src/routes/v1/auth.route.ts#L17) |
| GET /api/business/ | JWT | UserController.getMet | Organisation and onboarding / 1–2 | [src/routes/v1/business.route.ts:25](../src/routes/v1/business.route.ts#L25) |
| GET /api/business/energies | JWT | UserController.getBusinessEnergy | Meters, end-use and tariffs / 2–3 | [src/routes/v1/business.route.ts:26](../src/routes/v1/business.route.ts#L26) |
| GET /api/business/sites | JWT | UserController.getSites | Sites and meters / 2 | [src/routes/v1/business.route.ts:27](../src/routes/v1/business.route.ts#L27) |
| GET /api/business/foors | JWT | UserController.getBusinessFloors | Optional site spaces / 2 | [src/routes/v1/business.route.ts:28](../src/routes/v1/business.route.ts#L28) |
| GET /api/business/patterns | JWT | UserController.getPatterns | Drivers and operating history / 3 | [src/routes/v1/business.route.ts:29](../src/routes/v1/business.route.ts#L29) |
| GET /api/business/logs | JWT | UserController.getLogs | Drivers and operating history / 3 | [src/routes/v1/business.route.ts:30](../src/routes/v1/business.route.ts#L30) |
| PUT /api/business/ | JWT | UserController.updateUser | Organisation and onboarding / 1–2 | [src/routes/v1/business.route.ts:32](../src/routes/v1/business.route.ts#L32) |
| POST /api/business/saveEnergy | JWT | UserController.saveEnergy | Energy and units / 3–5 | [src/routes/v1/business.route.ts:42](../src/routes/v1/business.route.ts#L42) |
| POST /api/business/savePattern | JWT | UserController.savePattenrs | Drivers and operating history / 3 | [src/routes/v1/business.route.ts:52](../src/routes/v1/business.route.ts#L52) |
| POST /api/business/addLog | JWT | UserController.addLog | Drivers and operating history / 3 | [src/routes/v1/business.route.ts:62](../src/routes/v1/business.route.ts#L62) |
| POST /api/business/setTenants | JWT | UserController.setTenants | Drivers and operating history / 3 | [src/routes/v1/business.route.ts:72](../src/routes/v1/business.route.ts#L72) |
| POST /api/business/setFloors | JWT | UserController.setFloors | Sites and meters / 2 | [src/routes/v1/business.route.ts:82](../src/routes/v1/business.route.ts#L82) |
| POST /api/business/setReviews | JWT | UserController.setReviews | Opportunities and evidence / 6 | [src/routes/v1/business.route.ts:92](../src/routes/v1/business.route.ts#L92) |
| POST /api/business/setProgrammes | JWT | UserController.setProgrammes | Opportunities and evidence / 6 | [src/routes/v1/business.route.ts:102](../src/routes/v1/business.route.ts#L102) |
| POST /api/business/importBusiness | No route auth | UserController.importFile | Data import / 2–3 | [src/routes/v1/business.route.ts:112](../src/routes/v1/business.route.ts#L112) |
| POST /api/business/importTenants | JWT | UserController.importTenants | Data import / 2–3 | [src/routes/v1/business.route.ts:119](../src/routes/v1/business.route.ts#L119) |
| POST /api/business/importPatterns | JWT | UserController.importPatterns | Data import / 2–3 | [src/routes/v1/business.route.ts:127](../src/routes/v1/business.route.ts#L127) |
| GET /api/conversionUnit/ | JWT | ConversionController.getConversionUnitValues | Energy and units / 3–5 | [src/routes/v1/conversionUnit.route.ts:8](../src/routes/v1/conversionUnit.route.ts#L8) |
| GET /api/dashboard/ | JWT | DashboardController.getDataByYear | Overview and site performance / 5 | [src/routes/v1/dashboard.route.ts:14](../src/routes/v1/dashboard.route.ts#L14) |
| GET /api/dashboard/reports | JWT | DashboardController.getReporData | Reports / 5, 7 | [src/routes/v1/dashboard.route.ts:15](../src/routes/v1/dashboard.route.ts#L15) |
| GET /api/dashboard/carbonFootprint | JWT | DashboardController.getcarbonFootprint | Carbon / 5 | [src/routes/v1/dashboard.route.ts:16](../src/routes/v1/dashboard.route.ts#L16) |
| GET /api/dashboard/portfolio | JWT | DashboardController.getPortfolioData | Overview and site performance / 5 | [src/routes/v1/dashboard.route.ts:23](../src/routes/v1/dashboard.route.ts#L23) |
| GET /api/dashboard/energyWaste | JWT | DashboardController.energyWaste | Baseline and Waste & Savings / 4–5 | [src/routes/v1/dashboard.route.ts:30](../src/routes/v1/dashboard.route.ts#L30) |
| GET /api/dashboard/getReport | JWT | DashboardController.reports | Reports / 5, 7 | [src/routes/v1/dashboard.route.ts:37](../src/routes/v1/dashboard.route.ts#L37) |
| GET /api/site/details/:siteId | JWT | SitesController.getSiteDetails | Sites and meters / 2 | [src/routes/v1/sites.route.ts:16](../src/routes/v1/sites.route.ts#L16) |
| GET /api/site/countries | No route auth | SitesController.getCountries | Sites and meters / 2 | [src/routes/v1/sites.route.ts:17](../src/routes/v1/sites.route.ts#L17) |
| GET /api/site/states | No route auth | SitesController.getStates | Sites and meters / 2 | [src/routes/v1/sites.route.ts:18](../src/routes/v1/sites.route.ts#L18) |
| POST /api/site/ | JWT | SitesController.createSite | Sites and meters / 2 | [src/routes/v1/sites.route.ts:20](../src/routes/v1/sites.route.ts#L20) |
| POST /api/site/setConversionUnit/:siteId | JWT | SitesController.setSiteUnitConversion | Energy and units / 3–5 | [src/routes/v1/sites.route.ts:30](../src/routes/v1/sites.route.ts#L30) |
| PUT /api/site/update/:siteId | JWT | SitesController.updateSite | Sites and meters / 2 | [src/routes/v1/sites.route.ts:40](../src/routes/v1/sites.route.ts#L40) |
| DELETE /api/site/ | JWT | SitesController.deleteSite | Sites and meters / 2 | [src/routes/v1/sites.route.ts:50](../src/routes/v1/sites.route.ts#L50) |
| GET /api/utility/savingTips | JWT | UtilityController.getSavingTips | Opportunities and evidence / 6 | [src/routes/v1/utility.route.ts:20](../src/routes/v1/utility.route.ts#L20) |
| GET /api/utility/fuelSources | JWT | UtilityController.getFuelSources | Energy and units / 3–5 | [src/routes/v1/utility.route.ts:21](../src/routes/v1/utility.route.ts#L21) |
| GET /api/utility/fuelUse | JWT | UtilityController.getUses | Energy and units / 3–5 | [src/routes/v1/utility.route.ts:22](../src/routes/v1/utility.route.ts#L22) |
| GET /api/utility/emissions | JWT | UtilityController.getEmissions | Carbon / 5 | [src/routes/v1/utility.route.ts:23](../src/routes/v1/utility.route.ts#L23) |
| GET /api/utility/consumptions | JWT | UtilityController.getConsumptions | Energy and units / 3–5 | [src/routes/v1/utility.route.ts:24](../src/routes/v1/utility.route.ts#L24) |
| GET /api/utility/monitoring | JWT | UtilityController.getMonitoring | Energy and units / 3–5 | [src/routes/v1/utility.route.ts:25](../src/routes/v1/utility.route.ts#L25) |
| GET /api/utility/businessTips | JWT | UtilityController.getBusinessTips | Opportunities and evidence / 6 | [src/routes/v1/utility.route.ts:26](../src/routes/v1/utility.route.ts#L26) |
| POST /api/utility/addEmission | JWT | UtilityController.addEmission | Carbon / 5 | [src/routes/v1/utility.route.ts:28](../src/routes/v1/utility.route.ts#L28) |
| POST /api/utility/addConsumption | JWT | UtilityController.addConsumption | Energy and units / 3–5 | [src/routes/v1/utility.route.ts:38](../src/routes/v1/utility.route.ts#L38) |
| POST /api/utility/addMonitoring | JWT | UtilityController.addMonitoring | Energy and units / 3–5 | [src/routes/v1/utility.route.ts:48](../src/routes/v1/utility.route.ts#L48) |
| POST /api/utility/importUtility | JWT | UtilityController.importFile | Data import / 2–3 | [src/routes/v1/utility.route.ts:58](../src/routes/v1/utility.route.ts#L58) |
| POST /api/utility/importLogs | JWT | UtilityController.importLog | Data import / 2–3 | [src/routes/v1/utility.route.ts:66](../src/routes/v1/utility.route.ts#L66) |
| POST /api/utility/importUtilityEmissions | JWT | UtilityController.importUtilityEmissionFromFile | Data import / 2–3 | [src/routes/v1/utility.route.ts:74](../src/routes/v1/utility.route.ts#L74) |
| POST /api/utility/mapTipToBusiness | JWT | UtilityController.saveTipsMapping | Opportunities and evidence / 6 | [src/routes/v1/utility.route.ts:81](../src/routes/v1/utility.route.ts#L81) |

Root security observations: business import is unauthenticated at the route; country/state lookup is public. Site details/delete/update/conversion paths use unscoped site lookups. Some business methods explicitly check business ownership (for example addLog, setTenants, reviews and programmes), but imports and other writes do not do so consistently. The conversion target query has no mandatory business scope. See COMPATIBILITY_DECISIONS.md for evidence and required replacement tests.

## Nested API route catalogue

Routes mount at `/` in nested app.ts; there is no global auth middleware in the inspected application. This smaller API is a separate reference, not evidence that omitted UI features never existed.

| Endpoint | Authentication | Replacement destination / sprint | Evidence |
| --- | --- | --- | --- |
| POST /signup | No route auth | Application shell and shared UI / 1 | [Energiepad/energeiapdapi/src/routes/auth.route.ts:18](../Energiepad/energeiapdapi/src/routes/auth.route.ts#L18) |
| POST /login | No route auth | Identity and memberships / 1 | [Energiepad/energeiapdapi/src/routes/auth.route.ts:19](../Energiepad/energeiapdapi/src/routes/auth.route.ts#L19) |
| POST /logout | Auth middleware | Drivers and operating history / 3 | [Energiepad/energeiapdapi/src/routes/auth.route.ts:20](../Energiepad/energeiapdapi/src/routes/auth.route.ts#L20) |
| GET /business | No route auth | Organisation and onboarding / 1–2 | [Energiepad/energeiapdapi/src/routes/business.route.ts:18](../Energiepad/energeiapdapi/src/routes/business.route.ts#L18) |
| GET /business/:id(\\d+) | No route auth | Organisation and onboarding / 1–2 | [Energiepad/energeiapdapi/src/routes/business.route.ts:19](../Energiepad/energeiapdapi/src/routes/business.route.ts#L19) |
| POST /business | No route auth | Organisation and onboarding / 1–2 | [Energiepad/energeiapdapi/src/routes/business.route.ts:20](../Energiepad/energeiapdapi/src/routes/business.route.ts#L20) |
| PUT /business/:id(\\d+) | No route auth | Organisation and onboarding / 1–2 | [Energiepad/energeiapdapi/src/routes/business.route.ts:21](../Energiepad/energeiapdapi/src/routes/business.route.ts#L21) |
| DELETE /business/:id(\\d+) | No route auth | Organisation and onboarding / 1–2 | [Energiepad/energeiapdapi/src/routes/business.route.ts:22](../Energiepad/energeiapdapi/src/routes/business.route.ts#L22) |
| GET / | No route auth | Application shell and shared UI / 1 | [Energiepad/energeiapdapi/src/routes/index.route.ts:15](../Energiepad/energeiapdapi/src/routes/index.route.ts#L15) |
| GET /users | No route auth | Identity and memberships / 1 | [Energiepad/energeiapdapi/src/routes/users.route.ts:17](../Energiepad/energeiapdapi/src/routes/users.route.ts#L17) |
| GET /users/:id(\\d+) | No route auth | Identity and memberships / 1 | [Energiepad/energeiapdapi/src/routes/users.route.ts:18](../Energiepad/energeiapdapi/src/routes/users.route.ts#L18) |
| POST /users | No route auth | Identity and memberships / 1 | [Energiepad/energeiapdapi/src/routes/users.route.ts:19](../Energiepad/energeiapdapi/src/routes/users.route.ts#L19) |
| PUT /users/:id(\\d+) | No route auth | Identity and memberships / 1 | [Energiepad/energeiapdapi/src/routes/users.route.ts:20](../Energiepad/energeiapdapi/src/routes/users.route.ts#L20) |
| DELETE /users/:id(\\d+) | No route auth | Identity and memberships / 1 | [Energiepad/energeiapdapi/src/routes/users.route.ts:21](../Energiepad/energeiapdapi/src/routes/users.route.ts#L21) |
| GET /Utilities | No route auth | Application shell and shared UI / 1 | [Energiepad/energeiapdapi/src/routes/utilities.route.ts:18](../Energiepad/energeiapdapi/src/routes/utilities.route.ts#L18) |
| GET /Utilities/:id(\\d+) | No route auth | Application shell and shared UI / 1 | [Energiepad/energeiapdapi/src/routes/utilities.route.ts:19](../Energiepad/energeiapdapi/src/routes/utilities.route.ts#L19) |
| POST /Utilities | No route auth | Application shell and shared UI / 1 | [Energiepad/energeiapdapi/src/routes/utilities.route.ts:20](../Energiepad/energeiapdapi/src/routes/utilities.route.ts#L20) |
| PUT /Utilities/:id(\\d+) | No route auth | Application shell and shared UI / 1 | [Energiepad/energeiapdapi/src/routes/utilities.route.ts:21](../Energiepad/energeiapdapi/src/routes/utilities.route.ts#L21) |
| DELETE /Utilities/:id(\\d+) | No route auth | Application shell and shared UI / 1 | [Energiepad/energeiapdapi/src/routes/utilities.route.ts:22](../Energiepad/energeiapdapi/src/routes/utilities.route.ts#L22) |

Nested schema inconsistencies: UtilitiesModel declares tableName `businesses`; BuildingEnergyModel also declares `businesses` and returns an unresolved BusinessModel identifier. Treat these as source defects and verify actual schema before migrating. Do not run nested Sequelize sync against production.

## UI service calls and hook requests

`BaseAxios` sets the base URL to the legacy production API and attaches a localStorage JWT. No requests were executed during discovery. Hook entries marked “config” show declared URL configurations; method overrides and dynamically supplied modal URLs are described after the table. Each call inherits the disposition and sprint of its destination.

| Call type | URL expression | Disposition / module | Sprint | Evidence |
| --- | --- | --- | --- | --- |
| config | "/business/sites" | Retain → Sites and meters | 2 | [Energiepad/energiepadui/src/Analytics/EnergyLog/EnergyLogState.ts:33](../Energiepad/energiepadui/src/Analytics/EnergyLog/EnergyLogState.ts#L33) |
| config | `/business/logs?siteId=${site.id}&year=${year.value}&month=${month.value}` | Redesign → Drivers and operating history | 3 | [Energiepad/energiepadui/src/Analytics/EnergyLog/EnergyLogState.ts:41](../Energiepad/energiepadui/src/Analytics/EnergyLog/EnergyLogState.ts#L41) |
| config | "/utility/savingTips" | Redesign → Opportunities and evidence | 6 | [Energiepad/energiepadui/src/Analytics/EnergySavingTips.tsx:14](../Energiepad/energiepadui/src/Analytics/EnergySavingTips.tsx#L14) |
| config | "/business/sites" | Retain → Sites and meters | 2 | [Energiepad/energiepadui/src/Analytics/Portfolio/PortfolioState.ts:32](../Energiepad/energiepadui/src/Analytics/Portfolio/PortfolioState.ts#L32) |
| config | "/dashboard/portfolio" | Redesign → Overview and site performance | 5 | [Energiepad/energiepadui/src/Analytics/Portfolio/PortfolioState.ts:42](../Energiepad/energiepadui/src/Analytics/Portfolio/PortfolioState.ts#L42) |
| config | "/utility/fuelSources" | Redesign → Energy and units | 3–5 | [Energiepad/energiepadui/src/Analytics/Portfolio/PortfolioState.ts:49](../Energiepad/energiepadui/src/Analytics/Portfolio/PortfolioState.ts#L49) |
| config | `/dashboard/portfolio?year=${year.value}&fuelSourceId=${fuelSource.value}&month=${month.value}` | Redesign → Overview and site performance | 5 | [Energiepad/energiepadui/src/Analytics/Portfolio/PortfolioState.ts:88](../Energiepad/energiepadui/src/Analytics/Portfolio/PortfolioState.ts#L88) |
| config | "/utility/fuelSources" | Redesign → Energy and units | 3–5 | [Energiepad/energiepadui/src/Analytics/Report/ReportState.ts:45](../Energiepad/energiepadui/src/Analytics/Report/ReportState.ts#L45) |
| config | "/utility/fuelUse" | Redesign → Energy and units | 3–5 | [Energiepad/energiepadui/src/Analytics/Report/ReportState.ts:52](../Energiepad/energiepadui/src/Analytics/Report/ReportState.ts#L52) |
| config | "/business/sites" | Retain → Sites and meters | 2 | [Energiepad/energiepadui/src/Analytics/Report/ReportState.ts:59](../Energiepad/energiepadui/src/Analytics/Report/ReportState.ts#L59) |
| config | "/dashboard/getReport" | Redesign → Reports | 5, 7 | [Energiepad/energiepadui/src/Analytics/Report/ReportState.ts:66](../Energiepad/energiepadui/src/Analytics/Report/ReportState.ts#L66) |
| config | "/dashboard" | Redesign → Overview and site performance | 5 | [Energiepad/energiepadui/src/Analytics/UtilityLeague/LeageState.ts:129](../Energiepad/energiepadui/src/Analytics/UtilityLeague/LeageState.ts#L129) |
| config | "/business/sites" | Retain → Sites and meters | 2 | [Energiepad/energiepadui/src/Analytics/UtilityLeague/LeageState.ts:136](../Energiepad/energiepadui/src/Analytics/UtilityLeague/LeageState.ts#L136) |
| config | "/utility/fuelSources" | Redesign → Energy and units | 3–5 | [Energiepad/energiepadui/src/Analytics/UtilityLeague/LeageState.ts:143](../Energiepad/energiepadui/src/Analytics/UtilityLeague/LeageState.ts#L143) |
| config | "/dashboard/carbonFootprint" | Redesign → Carbon | 5 | [Energiepad/energiepadui/src/Analytics/UtilityLeague/LeageState.ts:153](../Energiepad/energiepadui/src/Analytics/UtilityLeague/LeageState.ts#L153) |
| config | "/dashboard/carbonFootprint" | Redesign → Carbon | 5 | [Energiepad/energiepadui/src/Analytics/UtilityLeague/LeageState.ts:164](../Energiepad/energiepadui/src/Analytics/UtilityLeague/LeageState.ts#L164) |
| config | "/dashboard/energyWaste" | Redesign → Baseline and Waste & Savings | 4–5 | [Energiepad/energiepadui/src/Analytics/UtilityLeague/LeageState.ts:173](../Energiepad/energiepadui/src/Analytics/UtilityLeague/LeageState.ts#L173) |
| config | "/dashboard/energyWaste" | Redesign → Baseline and Waste & Savings | 4–5 | [Energiepad/energiepadui/src/Analytics/UtilityLeague/LeageState.ts:182](../Energiepad/energiepadui/src/Analytics/UtilityLeague/LeageState.ts#L182) |
| config | "/site/countries" | Retain → Sites and meters | 2 | [Energiepad/energiepadui/src/Components/ApiCountrySelect.tsx:17](../Energiepad/energiepadui/src/Components/ApiCountrySelect.tsx#L17) |
| config | "/site/states" | Retain → Sites and meters | 2 | [Energiepad/energiepadui/src/Components/ApiStateSelect.tsx:21](../Energiepad/energiepadui/src/Components/ApiStateSelect.tsx#L21) |
| config | "/utility/fuelSources" | Redesign → Energy and units | 3–5 | [Energiepad/energiepadui/src/Components/FuelSourceSelect.tsx:23](../Energiepad/energiepadui/src/Components/FuelSourceSelect.tsx#L23) |
| config | "/business/sites" | Retain → Sites and meters | 2 | [Energiepad/energiepadui/src/Components/SiteList.tsx:36](../Energiepad/energiepadui/src/Components/SiteList.tsx#L36) |
| config | "/auth/login/" | Replace → Identity and memberships | 1 | [Energiepad/energiepadui/src/Login.tsx:11](../Energiepad/energiepadui/src/Login.tsx#L11) |
| post | "/auth" | Replace → Identity and memberships | 1 | [Energiepad/energiepadui/src/Services/Auth.ts:7](../Energiepad/energiepadui/src/Services/Auth.ts#L7) |
| post | "/auth/login/" | Replace → Identity and memberships | 1 | [Energiepad/energiepadui/src/Services/Auth.ts:16](../Energiepad/energiepadui/src/Services/Auth.ts#L16) |
| post | "/business/savePattern" | Redesign → Drivers and operating history | 3 | [Energiepad/energiepadui/src/Services/Business.ts:25](../Energiepad/energiepadui/src/Services/Business.ts#L25) |
| put | "/business/" | Redesign → Organisation and onboarding | 1–2 | [Energiepad/energiepadui/src/Services/Business.ts:41](../Energiepad/energiepadui/src/Services/Business.ts#L41) |
| post | "/business/setReviews" | Redesign → Opportunities and evidence | 6 | [Energiepad/energiepadui/src/Services/Review.ts:6](../Energiepad/energiepadui/src/Services/Review.ts#L6) |
| post | "/business/setProgrammes" | Redesign → Opportunities and evidence | 6 | [Energiepad/energiepadui/src/Services/Review.ts:15](../Energiepad/energiepadui/src/Services/Review.ts#L15) |
| put | `/site/update/${site.id}` | Retain → Sites and meters | 2 | [Energiepad/energiepadui/src/Services/Site.ts:8](../Energiepad/energiepadui/src/Services/Site.ts#L8) |
| post | "/site/" | Retain → Sites and meters | 2 | [Energiepad/energiepadui/src/Services/Site.ts:11](../Energiepad/energiepadui/src/Services/Site.ts#L11) |
| get | "/business/sites" | Retain → Sites and meters | 2 | [Energiepad/energiepadui/src/Services/Site.ts:21](../Energiepad/energiepadui/src/Services/Site.ts#L21) |
| get | "/site/details/" + id | Retain → Sites and meters | 2 | [Energiepad/energiepadui/src/Services/Site.ts:30](../Energiepad/energiepadui/src/Services/Site.ts#L30) |
| delete | "/site" | Retain → Sites and meters | 2 | [Energiepad/energiepadui/src/Services/Site.ts:42](../Energiepad/energiepadui/src/Services/Site.ts#L42) |
| post | "/business/saveEnergy" | Redesign → Energy and units | 3–5 | [Energiepad/energiepadui/src/Services/Site.ts:50](../Energiepad/energiepadui/src/Services/Site.ts#L50) |
| post | `utility/addConsumption` | Redesign → Energy and units | 3–5 | [Energiepad/energiepadui/src/Services/Utility.ts:74](../Energiepad/energiepadui/src/Services/Utility.ts#L74) |
| post | `utility/addEmission` | Redesign → Carbon | 5 | [Energiepad/energiepadui/src/Services/Utility.ts:120](../Energiepad/energiepadui/src/Services/Utility.ts#L120) |
| post | `utility/addMonitoring` | Redesign → Energy and units | 3–5 | [Energiepad/energiepadui/src/Services/Utility.ts:167](../Energiepad/energiepadui/src/Services/Utility.ts#L167) |
| post | "/utility/importUtility/" | Replace → Data import | 2–3 | [Energiepad/energiepadui/src/Services/Utility.ts:180](../Energiepad/energiepadui/src/Services/Utility.ts#L180) |
| config | "/utility/fuelUse" | Redesign → Energy and units | 3–5 | [Energiepad/energiepadui/src/Settings/BuildingEnergyPatterns/BuildingEnergyPatterns.tsx:50](../Energiepad/energiepadui/src/Settings/BuildingEnergyPatterns/BuildingEnergyPatterns.tsx#L50) |
| config | "/business/patterns" | Redesign → Drivers and operating history | 3 | [Energiepad/energiepadui/src/Settings/BuildingEnergyPatterns/BuildingEnergyPatterns.tsx:55](../Energiepad/energiepadui/src/Settings/BuildingEnergyPatterns/BuildingEnergyPatterns.tsx#L55) |
| config | "/business" | Redesign → Organisation and onboarding | 1–2 | [Energiepad/energiepadui/src/Settings/Business.tsx:70](../Energiepad/energiepadui/src/Settings/Business.tsx#L70) |
| config | url | Replace → Application shell and shared UI | 1 | [Energiepad/energiepadui/src/Settings/Comsumption/ConsumptionImportModal.tsx:49](../Energiepad/energiepadui/src/Settings/Comsumption/ConsumptionImportModal.tsx#L49) |
| config | url | Replace → Application shell and shared UI | 1 | [Energiepad/energiepadui/src/Settings/Comsumption/SimpleImportModal.tsx:46](../Energiepad/energiepadui/src/Settings/Comsumption/SimpleImportModal.tsx#L46) |
| config | "/utility/fuelSources" | Redesign → Energy and units | 3–5 | [Energiepad/energiepadui/src/Settings/UtilityAndEmissions.tsx:84](../Energiepad/energiepadui/src/Settings/UtilityAndEmissions.tsx#L84) |
| config | "/conversionUnit" | Redesign → Energy and units | 3–5 | [Energiepad/energiepadui/src/Settings/UtilityAndEmissions.tsx:91](../Energiepad/energiepadui/src/Settings/UtilityAndEmissions.tsx#L91) |
| config | "/utility/consumptions" | Redesign → Energy and units | 3–5 | [Energiepad/energiepadui/src/Settings/UtilityAndEmissions.tsx:98](../Energiepad/energiepadui/src/Settings/UtilityAndEmissions.tsx#L98) |
| config | "/utility/emissions" | Redesign → Carbon | 5 | [Energiepad/energiepadui/src/Settings/UtilityAndEmissions.tsx:105](../Energiepad/energiepadui/src/Settings/UtilityAndEmissions.tsx#L105) |
| config | "/utility/monitoring" | Redesign → Energy and units | 3–5 | [Energiepad/energiepadui/src/Settings/UtilityAndEmissions.tsx:112](../Energiepad/energiepadui/src/Settings/UtilityAndEmissions.tsx#L112) |
| config | "/utility/fuelUse" | Redesign → Energy and units | 3–5 | [Energiepad/energiepadui/src/Settings/UtilityAndEmissions.tsx:118](../Energiepad/energiepadui/src/Settings/UtilityAndEmissions.tsx#L118) |
| config | "/utility/fuelSources" | Redesign → Energy and units | 3–5 | [Energiepad/energiepadui/src/Settings/buildingEnergyForm/BuildingEnergy.tsx:60](../Energiepad/energiepadui/src/Settings/buildingEnergyForm/BuildingEnergy.tsx#L60) |
| config | "/utility/fuelSources" | Redesign → Energy and units | 3–5 | [Energiepad/energiepadui/src/Settings/buildingEnergyForm/FuelSourceInput.tsx:17](../Energiepad/energiepadui/src/Settings/buildingEnergyForm/FuelSourceInput.tsx#L17) |
| config | "/utility/fuelUse" | Redesign → Energy and units | 3–5 | [Energiepad/energiepadui/src/Settings/buildingEnergyForm/FuelUseInput.tsx:12](../Energiepad/energiepadui/src/Settings/buildingEnergyForm/FuelUseInput.tsx#L12) |

Import modal URLs supplied by Settings.tsx: POST `/utility/importUtilityEmissions`, `/utility/importLogs`, `/business/importBusiness`, `/business/importTenants`, `/business/importPatterns`. Both modal components receive their URL by prop and send FormData with `excel`; the repeated combined import entry is one contract. Login hook uses POST. The inactive EmissionService block in Services/Utility.ts is commented out and is not an active call.

## Import variants

| Parser | Legacy layout and behaviour | V2 disposition |
| --- | --- | --- |
| BusinessExcelClient | First sheet business, second sites; fixed column positions; password is hashed; missing required rows skipped; controller inserts only data[0]. | Replace in Sprint 2 with header mapping, per-row preview/errors, credential rejection, scoped site lookup and batch commit. |
| UtilityExcelClient | Five positional sheets: consumption, emissions, targets, setpoints and R/NR drivers; resolves site names/fuels/uses and units. Import controller deletes existing site/fuel/year consumption before insert. | Replace in Sprints 2–3 with explicit sheet contracts, correction lineage and idempotency; never silently erase other months. |
| UtilityEmissionExcelClient | Named Consumption, Emissions and Targets sheets; duplicate checks and upsert pipeline. | Retain concepts, replace parser with validated tenant-bound import. |
| OperationsExcelClient | First sheet; Site Code, Energy Demand, Start Date, End Date, Temperature set point, Days in the year. | Redesign as historical drivers/operating schedules in Sprint 3. |
| TenantExcelClient | First sheet; date, usedInId, siteId, irregularTenantAmount, regularTenantAmount. “Tenant” means building occupants here. | Redesign as occupancy observations; never map these people counts to SaaS memberships. |
| LogExcelClient | All sheets; fixed columns for dates/comments/operation/site/end-use; loops columns while appending rows 2–13. | Replace with row-based parsing; characterize duplicate/truncation behaviour without preserving it. |

## Analytics and calculations

- Three model entry points exist in waste.service.ts: wasteSingleNrv, wasteMultiAdjustment and wasteMultiNrv, selected by calculateWaste using R/NR driver classifications. Names alone do not establish the intended methodology.
- dashboard.service.ts contains additional older single-fuel and power/lighting/cooling routines; portfolio and older reports can use different calculation paths from energyWaste/getReport. Consolidate into one versioned calculation service after compatibility decisions.
- The current energyWaste/getReport controllers call the V2-named calculator but supply HDD/CDD/hours/daylight arrays from multi_nrv_hdd.ts. This is executable sample data, not persisted site weather; fetched provider data is used elsewhere for projections.
- GreenDaysServices calls DegreeDays using fixed postcode and country values in inspected paths. Weather persistence/methodology and asynchronous retries need replacement.
- Utility service includes consumingProjection; Dashboard service includes filled-month records marked produced, consumption statistics, carbon, financial cost and target comparisons. Keep missing data distinguishable from actual zero.
- Units utility supports L, m3 and kWh and rounds converted quantities to two decimals. Carbon lookup matches year/site/fuel, with an ignoreFuelSource mode; factor provenance and effective dates are absent from this logic.
- Existing outputs are not approved golden values. The available NRA workbook has formula/cache conflicts documented separately.

## Domain contracts

Root OpenAPI schemas are an API snapshot, not proof of current DB shape. Composite properties below are resolved through allOf and local schema references; nested/UI contracts appear afterward. Field transformations are in MIGRATION_MAP.md.

| Root schema | Fields | Disposition / destination / sprint |
| --- | --- | --- |
| GenericError | statusCode, message | Replace / Application shell and shared UI / 1 |
| SuccessMessage | success | Replace / Application shell and shared UI / 1 |
| Site | id, name, code, type, address, postCode, town, population, size, workinghours, fullTimeEmployee, countryId, stateId, vat | Retain / Sites and meters / 2 |
| JWTToken | jwt | Redesign / Identity and organisation services / 1–2 |
| BusinessPattern | startDate, endDate, temperature, daysOnYear, siteId, usedInId | Redesign / Drivers and operating history / 3 |
| Programme | question, siteId, usedInId, answers | Redesign / Opportunities and evidence / 6 |
| Review | question, siteId, answers | Redesign / Opportunities and evidence / 6 |
| BusinessBrand | name, rate, startTime, endTime, days | Redesign / Tariffs and tax / 3 |
| BusinessCost | currencyCode, vat | Redesign / Tariffs and tax / 3 |
| BusinessDistance | meters | Redesign / Meters / 2 |
| BusinessFloor | size, area, population | Retain / Sites and meters / 2 |
| SavingTip | id, category, text, imageUrl | Redesign / Opportunities and evidence / 6 |
| BusinessEnergy | fuelSourceId, usedInId, brands, meternumbers, cost | Redesign / Energy and units / 3–5 |
| Tenant | siteId, usedInId, date, regularTenantAmount, irregularTenantAmount | Redesign / Drivers and operating history / 3 |
| FuelSource | id, source, colorCode, usedIn | Redesign / Energy and units / 3–5 |
| EnergyLog | siteId, usedInId, operation, comments, startDate, endDate | Redesign / Drivers and operating history / 3 |
| FuelUse | use, id | Redesign / Energy and units / 3–5 |
| ConsumptionTarget | id, energy, carbon, conversionFactor, fuelUnit, date, siteId, fuelSourceId | Redesign / Targets and monitoring / 5 |
| RegisterBody | businessName, businessType, businessService, buildingName, contactName, position, phoneNumber, email, countryId, password, stateId, town, postCode, currencyCode, address_1, subscriptionDate, floors | Replace / Identity and memberships / 1 |
| User | businessName, businessType, businessService, buildingName, contactName, position, phoneNumber, email, countryId, password, stateId, town, postCode, currencyCode, address_1, subscriptionDate, floors, id, patterns | Redesign / Identity and organisation services / 1–2 |
| AddFuelSourceConsumptionBody | date, consumption, totalCost, conversionFactor, fuelUnit, vat, siteId, fuelSourceId, usedInId | Redesign / Energy and units / 3–5 |
| AddFuelSourceEmissionBody | emissionFactor, conversionFactor, date, fuelUnit, siteId, fuelSourceId | Redesign / Carbon / 5 |
| UtilityEmission | emissionFactor, conversionFactor, date, fuelUnit, siteId, fuelSourceId, id | Redesign / Carbon / 5 |
| UtilityConsumption | date, consumption, totalCost, conversionFactor, fuelUnit, vat, siteId, fuelSourceId, usedInId, id, fuelSourceName, siteName, usedIn, vatCost, population, workingHours | Redesign / Energy and units / 3–5 |

### UI and nested API types

| Contract | Declared fields | Disposition / destination / sprint | Evidence |
| --- | --- | --- | --- |
| BuildingPattern | patterns, siteId | Redesign / Drivers and operating history / 3 | [Energiepad/energiepadui/src/Models/BuildingPattern.ts:1](../Energiepad/energiepadui/src/Models/BuildingPattern.ts#L1) |
| Pattern | startDate, endDate, consumption, temperature, daysOnYear, usedInId | Redesign / Drivers and operating history / 3 | [Energiepad/energiepadui/src/Models/BuildingPattern.ts:6](../Energiepad/energiepadui/src/Models/BuildingPattern.ts#L6) |
| Consumption | consumption, cost, fuelSourceId, totalCost, fuelUnit, conversionFactor, vat, conversionUnit | Redesign / Energy and units / 3–5 | [Energiepad/energiepadui/src/Models/Consumption.ts:1](../Energiepad/energiepadui/src/Models/Consumption.ts#L1) |
| Emission | consumption, fuelSourceId, emissionFactor, conversionFactor, fuelUnit | Redesign / Carbon / 5 | [Energiepad/energiepadui/src/Models/Emission.ts:1](../Energiepad/energiepadui/src/Models/Emission.ts#L1) |
| Floor | size, area, population | Retain / Sites and meters / 2 | [Energiepad/energiepadui/src/Models/Floor.ts:1](../Energiepad/energiepadui/src/Models/Floor.ts#L1) |
| FuelSource | id, source, usedIn | Redesign / Energy and units / 3–5 | [Energiepad/energiepadui/src/Models/FuelSource.ts:1](../Energiepad/energiepadui/src/Models/FuelSource.ts#L1) |
| FuelUse | id, use | Redesign / Energy and units / 3–5 | [Energiepad/energiepadui/src/Models/FuelUse.ts:1](../Energiepad/energiepadui/src/Models/FuelUse.ts#L1) |
| Login | email, password | Replace / Identity and memberships / 1 | [Energiepad/energiepadui/src/Models/Login.ts:1](../Energiepad/energiepadui/src/Models/Login.ts#L1) |
| Log | siteId, operations, yearId, monthId | Redesign / Drivers and operating history / 3 | [Energiepad/energiepadui/src/Models/Logs.ts:2](../Energiepad/energiepadui/src/Models/Logs.ts#L2) |
| Operation | startDate, endDate, usedInID, comments | Replace / Application shell and shared UI / 1 | [Energiepad/energiepadui/src/Models/Logs.ts:8](../Energiepad/energiepadui/src/Models/Logs.ts#L8) |
| M_T | fuelUnit, fuelSourceId, conversionFactor, energy, carbon, conversionUnit | Redesign / Targets and monitoring / 5 | [Energiepad/energiepadui/src/Models/M_T.ts:1](../Energiepad/energiepadui/src/Models/M_T.ts#L1) |
| Option | value, label | Replace / Typed application infrastructure / 1 | [Energiepad/energiepadui/src/Models/Option.ts:1](../Energiepad/energiepadui/src/Models/Option.ts#L1) |
| Register | businessName, businessType, businessService, password, buildingName, contactName, position, phoneNumber, email, countryId, stateId, town, postCode, currencyCode, subscriptionDate, totalArea, totalPopulation, workingHoursStart, workingHoursEnd, address_1 | Replace / Identity and memberships / 1 | [Energiepad/energiepadui/src/Models/Register.ts:1](../Energiepad/energiepadui/src/Models/Register.ts#L1) |
| Review | siteId, question, answers, usedInId | Redesign / Opportunities and evidence / 6 | [Energiepad/energiepadui/src/Models/Review.ts:1](../Energiepad/energiepadui/src/Models/Review.ts#L1) |
| Site | id, code, type, name, address, postCode, town, population, size, workinghours, currencyCode, countryId, stateId, vat | Retain / Sites and meters / 2 | [Energiepad/energiepadui/src/Models/Site.ts:1](../Energiepad/energiepadui/src/Models/Site.ts#L1) |
| Tarriff | meternumbers, cost, brands, fuelSourceId, fuelName, usedInId | Redesign / Tariffs and tax / 3 | [Energiepad/energiepadui/src/Models/Tarriff.ts:3](../Energiepad/energiepadui/src/Models/Tarriff.ts#L3) |
| BuildingEnergy | records, site | Redesign / Energy and units / 3–5 | [Energiepad/energiepadui/src/Models/Tarriff.ts:11](../Energiepad/energiepadui/src/Models/Tarriff.ts#L11) |
| Distance | meters | Replace / Application shell and shared UI / 1 | [Energiepad/energiepadui/src/Models/Tarriff.ts:59](../Energiepad/energiepadui/src/Models/Tarriff.ts#L59) |
| Cost | currencyCode, vat | Replace / Application shell and shared UI / 1 | [Energiepad/energiepadui/src/Models/Tarriff.ts:62](../Energiepad/energiepadui/src/Models/Tarriff.ts#L62) |
| Brand | name, startTime, endTime, days, rate | Replace / Application shell and shared UI / 1 | [Energiepad/energiepadui/src/Models/Tarriff.ts:66](../Energiepad/energiepadui/src/Models/Tarriff.ts#L66) |
| DataStoredInToken | id | Replace / Typed application infrastructure / 1 | [Energiepad/energeiapdapi/src/interfaces/auth.interface.ts:4](../Energiepad/energeiapdapi/src/interfaces/auth.interface.ts#L4) |
| TokenData | token, expiresIn | Replace / Application shell and shared UI / 1 | [Energiepad/energeiapdapi/src/interfaces/auth.interface.ts:8](../Energiepad/energeiapdapi/src/interfaces/auth.interface.ts#L8) |
| RequestWithUser | user | Replace / Typed application infrastructure / 1 | [Energiepad/energeiapdapi/src/interfaces/auth.interface.ts:13](../Energiepad/energeiapdapi/src/interfaces/auth.interface.ts#L13) |
| BuildingEnergy | id, energyType, fuelSource, uses, billingCurrency | Redesign / Energy and units / 3–5 | [Energiepad/energeiapdapi/src/interfaces/buildingEnergy.interface.ts:8](../Energiepad/energeiapdapi/src/interfaces/buildingEnergy.interface.ts#L8) |
| Business | id, name, type, natureOfService, siteName, buildingName, country, state, town, startDate, endDate, buildingArea, businessContactName1, businessContactName2, position, phoneNumber, email | Redesign / Organisation and onboarding / 1–2 | [Energiepad/energeiapdapi/src/interfaces/business.interface.ts:1](../Energiepad/energeiapdapi/src/interfaces/business.interface.ts#L1) |
| dbConfig | host, user, password, database, pool, min, max | Replace / Application shell and shared UI / 1 | [Energiepad/energeiapdapi/src/interfaces/db.interface.ts:1](../Energiepad/energeiapdapi/src/interfaces/db.interface.ts#L1) |
| Routes | path, router | Replace / Typed application infrastructure / 1 | [Energiepad/energeiapdapi/src/interfaces/routes.interface.ts:3](../Energiepad/energeiapdapi/src/interfaces/routes.interface.ts#L3) |
| User | id, email, password | Redesign / Identity and organisation services / 1–2 | [Energiepad/energeiapdapi/src/interfaces/users.interface.ts:1](../Energiepad/energeiapdapi/src/interfaces/users.interface.ts#L1) |
| Utilities | id, name, value | Replace / Application shell and shared UI / 1 | [Energiepad/energeiapdapi/src/interfaces/utilities.interface.ts:1](../Energiepad/energeiapdapi/src/interfaces/utilities.interface.ts#L1) |
| Utility | id, utilities, vatRate, time, days, timeBrandRates, occupants, buildingEnergyId | Redesign / Energy and units / 3–5 | [Energiepad/energeiapdapi/src/interfaces/utility.interface.ts:9](../Energiepad/energeiapdapi/src/interfaces/utility.interface.ts#L9) |

## Source module index

Every canonical UI code module is included here, including subviews/charts/forms and shared infrastructure. Entries marked Replace refer to implementation, not automatic deletion of business data. Generated JS siblings share their canonical module's disposition and are listed in the snapshot manifest. Test helpers and infrastructure are replacement implementation concerns, not customer screens.

| UI module | Disposition / destination / sprint |
| --- | --- |
| [Energiepad/energiepadui/src/About.tsx](../Energiepad/energiepadui/src/About.tsx) | Retire (proposed from SaaS shell) / Marketing content outside authenticated app / 1 |
| [Energiepad/energiepadui/src/Analytics/Analytics.tsx](../Energiepad/energiepadui/src/Analytics/Analytics.tsx) | Redesign / Overview and analytics navigation / 5 |
| [Energiepad/energiepadui/src/Analytics/CarbonFootprint/Carbon.tsx](../Energiepad/energiepadui/src/Analytics/CarbonFootprint/Carbon.tsx) | Redesign / Carbon / 5 |
| [Energiepad/energiepadui/src/Analytics/CarbonFootprint/CarbonEmissionsTable.tsx](../Energiepad/energiepadui/src/Analytics/CarbonFootprint/CarbonEmissionsTable.tsx) | Redesign / Carbon / 5 |
| [Energiepad/energiepadui/src/Analytics/CarbonFootprint/CarbonFootprints.tsx](../Energiepad/energiepadui/src/Analytics/CarbonFootprint/CarbonFootprints.tsx) | Redesign / Carbon / 5 |
| [Energiepad/energiepadui/src/Analytics/CarbonFootprint/HorizontalGroup.tsx](../Energiepad/energiepadui/src/Analytics/CarbonFootprint/HorizontalGroup.tsx) | Redesign / Carbon / 5 |
| [Energiepad/energiepadui/src/Analytics/CarbonFootprint/HorizontalGrouped.tsx](../Energiepad/energiepadui/src/Analytics/CarbonFootprint/HorizontalGrouped.tsx) | Redesign / Carbon / 5 |
| [Energiepad/energiepadui/src/Analytics/Card.tsx](../Energiepad/energiepadui/src/Analytics/Card.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/Charts/Bars/DivergingBar.tsx](../Energiepad/energiepadui/src/Analytics/Charts/Bars/DivergingBar.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/Charts/Bars/DoubleSideBar.tsx](../Energiepad/energiepadui/src/Analytics/Charts/Bars/DoubleSideBar.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/Charts/Bars/GroupedBar.tsx](../Energiepad/energiepadui/src/Analytics/Charts/Bars/GroupedBar.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/Charts/Bars/OrdinaryBarChart.tsx](../Energiepad/energiepadui/src/Analytics/Charts/Bars/OrdinaryBarChart.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/Charts/Bars/StackedSigns.tsx](../Energiepad/energiepadui/src/Analytics/Charts/Bars/StackedSigns.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/Charts/Bars/Stacked_GroupedSigns.tsx](../Energiepad/energiepadui/src/Analytics/Charts/Bars/Stacked_GroupedSigns.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/Charts/Bars/Thermometer.tsx](../Energiepad/energiepadui/src/Analytics/Charts/Bars/Thermometer.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/Charts/Bars/VerticalGrouped.tsx](../Energiepad/energiepadui/src/Analytics/Charts/Bars/VerticalGrouped.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/Charts/Lines/LineChart.tsx](../Energiepad/energiepadui/src/Analytics/Charts/Lines/LineChart.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/Charts/Pies/Full.tsx](../Energiepad/energiepadui/src/Analytics/Charts/Pies/Full.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/Charts/Pies/PieChart.tsx](../Energiepad/energiepadui/src/Analytics/Charts/Pies/PieChart.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/Charts/Pies/Waste.tsx](../Energiepad/energiepadui/src/Analytics/Charts/Pies/Waste.tsx) | Redesign / Baseline and Waste & Savings / 4–5 |
| [Energiepad/energiepadui/src/Analytics/EnergyLog/EnergyLog.tsx](../Energiepad/energiepadui/src/Analytics/EnergyLog/EnergyLog.tsx) | Redesign / Drivers and operating history / 3 |
| [Energiepad/energiepadui/src/Analytics/EnergyLog/EnergyLogState.ts](../Energiepad/energiepadui/src/Analytics/EnergyLog/EnergyLogState.ts) | Redesign / Drivers and operating history / 3 |
| [Energiepad/energiepadui/src/Analytics/EnergySavingTips.tsx](../Energiepad/energiepadui/src/Analytics/EnergySavingTips.tsx) | Redesign / Opportunities and evidence / 6 |
| [Energiepad/energiepadui/src/Analytics/EnergyWaste/EnergyWaste.tsx](../Energiepad/energiepadui/src/Analytics/EnergyWaste/EnergyWaste.tsx) | Redesign / Baseline and Waste & Savings / 4–5 |
| [Energiepad/energiepadui/src/Analytics/EnergyWaste/Horizontal.tsx](../Energiepad/energiepadui/src/Analytics/EnergyWaste/Horizontal.tsx) | Redesign / Baseline and Waste & Savings / 4–5 |
| [Energiepad/energiepadui/src/Analytics/EnergyWaste/LargeBarChart.tsx](../Energiepad/energiepadui/src/Analytics/EnergyWaste/LargeBarChart.tsx) | Redesign / Baseline and Waste & Savings / 4–5 |
| [Energiepad/energiepadui/src/Analytics/EnergyWaste/SideMenu.tsx](../Energiepad/energiepadui/src/Analytics/EnergyWaste/SideMenu.tsx) | Redesign / Baseline and Waste & Savings / 4–5 |
| [Energiepad/energiepadui/src/Analytics/EnergyWaste/WasteTable.tsx](../Energiepad/energiepadui/src/Analytics/EnergyWaste/WasteTable.tsx) | Redesign / Baseline and Waste & Savings / 4–5 |
| [Energiepad/energiepadui/src/Analytics/FuelCard.tsx](../Energiepad/energiepadui/src/Analytics/FuelCard.tsx) | Redesign / Energy and units / 3–5 |
| [Energiepad/energiepadui/src/Analytics/Layout.tsx](../Energiepad/energiepadui/src/Analytics/Layout.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/OverlappingInfo.tsx](../Energiepad/energiepadui/src/Analytics/OverlappingInfo.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/Portfolio/Portfolio.tsx](../Energiepad/energiepadui/src/Analytics/Portfolio/Portfolio.tsx) | Redesign / Overview and site performance / 5 |
| [Energiepad/energiepadui/src/Analytics/Portfolio/PortfolioBarChart.tsx](../Energiepad/energiepadui/src/Analytics/Portfolio/PortfolioBarChart.tsx) | Redesign / Overview and site performance / 5 |
| [Energiepad/energiepadui/src/Analytics/Portfolio/PortfolioLineChart.tsx](../Energiepad/energiepadui/src/Analytics/Portfolio/PortfolioLineChart.tsx) | Redesign / Overview and site performance / 5 |
| [Energiepad/energiepadui/src/Analytics/Portfolio/PortfolioSideMenu.tsx](../Energiepad/energiepadui/src/Analytics/Portfolio/PortfolioSideMenu.tsx) | Redesign / Overview and site performance / 5 |
| [Energiepad/energiepadui/src/Analytics/Portfolio/PortfolioState.ts](../Energiepad/energiepadui/src/Analytics/Portfolio/PortfolioState.ts) | Redesign / Overview and site performance / 5 |
| [Energiepad/energiepadui/src/Analytics/Portfolio/PortfolioTable.tsx](../Energiepad/energiepadui/src/Analytics/Portfolio/PortfolioTable.tsx) | Redesign / Overview and site performance / 5 |
| [Energiepad/energiepadui/src/Analytics/Report/ReportState.ts](../Energiepad/energiepadui/src/Analytics/Report/ReportState.ts) | Redesign / Reports / 5, 7 |
| [Energiepad/energiepadui/src/Analytics/Report/ReportTargetTable.tsx](../Energiepad/energiepadui/src/Analytics/Report/ReportTargetTable.tsx) | Redesign / Reports / 5, 7 |
| [Energiepad/energiepadui/src/Analytics/Report/Reports.tsx](../Energiepad/energiepadui/src/Analytics/Report/Reports.tsx) | Redesign / Reports / 5, 7 |
| [Energiepad/energiepadui/src/Analytics/Report/ReportsSidebar.tsx](../Energiepad/energiepadui/src/Analytics/Report/ReportsSidebar.tsx) | Redesign / Reports / 5, 7 |
| [Energiepad/energiepadui/src/Analytics/RightSideBar.tsx](../Energiepad/energiepadui/src/Analytics/RightSideBar.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/SideBar.tsx](../Energiepad/energiepadui/src/Analytics/SideBar.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/SideMenu/Base.tsx](../Energiepad/energiepadui/src/Analytics/SideMenu/Base.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/SideMenu/EnergyLog.tsx](../Energiepad/energiepadui/src/Analytics/SideMenu/EnergyLog.tsx) | Redesign / Drivers and operating history / 3 |
| [Energiepad/energiepadui/src/Analytics/SideMenu/EnergySavingTips.tsx](../Energiepad/energiepadui/src/Analytics/SideMenu/EnergySavingTips.tsx) | Redesign / Opportunities and evidence / 6 |
| [Energiepad/energiepadui/src/Analytics/SideMenu/Site.tsx](../Energiepad/energiepadui/src/Analytics/SideMenu/Site.tsx) | Retain / Sites and meters / 2 |
| [Energiepad/energiepadui/src/Analytics/SideMenu/carbonfootprint.tsx](../Energiepad/energiepadui/src/Analytics/SideMenu/carbonfootprint.tsx) | Redesign / Carbon / 5 |
| [Energiepad/energiepadui/src/Analytics/Tables/BuildingOperationsTable.tsx](../Energiepad/energiepadui/src/Analytics/Tables/BuildingOperationsTable.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/Tables/BuildingUserTables.tsx](../Energiepad/energiepadui/src/Analytics/Tables/BuildingUserTables.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/Tables/ReportsTable.tsx](../Energiepad/energiepadui/src/Analytics/Tables/ReportsTable.tsx) | Redesign / Reports / 5, 7 |
| [Energiepad/energiepadui/src/Analytics/Tables/UtilityTables.tsx](../Energiepad/energiepadui/src/Analytics/Tables/UtilityTables.tsx) | Redesign / Energy and units / 3–5 |
| [Energiepad/energiepadui/src/Analytics/TopMenu.tsx](../Energiepad/energiepadui/src/Analytics/TopMenu.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Analytics/UtilityLeague/ConsumptionPanel.tsx](../Energiepad/energiepadui/src/Analytics/UtilityLeague/ConsumptionPanel.tsx) | Redesign / Overview and site performance / 5 |
| [Energiepad/energiepadui/src/Analytics/UtilityLeague/CostPanel.tsx](../Energiepad/energiepadui/src/Analytics/UtilityLeague/CostPanel.tsx) | Redesign / Overview and site performance / 5 |
| [Energiepad/energiepadui/src/Analytics/UtilityLeague/FuelPanel.tsx](../Energiepad/energiepadui/src/Analytics/UtilityLeague/FuelPanel.tsx) | Redesign / Overview and site performance / 5 |
| [Energiepad/energiepadui/src/Analytics/UtilityLeague/IncreasedPercentage.tsx](../Energiepad/energiepadui/src/Analytics/UtilityLeague/IncreasedPercentage.tsx) | Redesign / Overview and site performance / 5 |
| [Energiepad/energiepadui/src/Analytics/UtilityLeague/LeageState.ts](../Energiepad/energiepadui/src/Analytics/UtilityLeague/LeageState.ts) | Redesign / Overview and site performance / 5 |
| [Energiepad/energiepadui/src/Analytics/UtilityLeague/TargetConsumptionPanel.tsx](../Energiepad/energiepadui/src/Analytics/UtilityLeague/TargetConsumptionPanel.tsx) | Redesign / Overview and site performance / 5 |
| [Energiepad/energiepadui/src/Analytics/UtilityLeague/UtilityLeague.tsx](../Energiepad/energiepadui/src/Analytics/UtilityLeague/UtilityLeague.tsx) | Redesign / Overview and site performance / 5 |
| [Energiepad/energiepadui/src/App.test.tsx](../Energiepad/energiepadui/src/App.test.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/App.tsx](../Energiepad/energiepadui/src/App.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Blog.tsx](../Energiepad/energiepadui/src/Blog.tsx) | Retire (proposed from SaaS shell) / Marketing content outside authenticated app / 1 |
| [Energiepad/energiepadui/src/Components/ApiCountrySelect.tsx](../Energiepad/energiepadui/src/Components/ApiCountrySelect.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Components/ApiStateSelect.tsx](../Energiepad/energiepadui/src/Components/ApiStateSelect.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Components/AxiosRequestFactory.tsx](../Energiepad/energiepadui/src/Components/AxiosRequestFactory.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Components/DateRange.tsx](../Energiepad/energiepadui/src/Components/DateRange.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Components/ErrorLabel.tsx](../Energiepad/energiepadui/src/Components/ErrorLabel.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Components/FuelSourceSelect.tsx](../Energiepad/energiepadui/src/Components/FuelSourceSelect.tsx) | Redesign / Energy and units / 3–5 |
| [Energiepad/energiepadui/src/Components/PrivateRoute.tsx](../Energiepad/energiepadui/src/Components/PrivateRoute.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Components/Select2Buttons.tsx](../Energiepad/energiepadui/src/Components/Select2Buttons.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Components/SiteList.tsx](../Energiepad/energiepadui/src/Components/SiteList.tsx) | Retain / Sites and meters / 2 |
| [Energiepad/energiepadui/src/Contact.tsx](../Energiepad/energiepadui/src/Contact.tsx) | Retire (proposed from SaaS shell) / Marketing content outside authenticated app / 1 |
| [Energiepad/energiepadui/src/FormsTop.tsx](../Energiepad/energiepadui/src/FormsTop.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Galllery.tsx](../Energiepad/energiepadui/src/Galllery.tsx) | Retire (proposed from SaaS shell) / Marketing content outside authenticated app / 1 |
| [Energiepad/energiepadui/src/Helper/ApiStringDateToDate.ts](../Energiepad/energiepadui/src/Helper/ApiStringDateToDate.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Helper/DateFormat.ts](../Energiepad/energiepadui/src/Helper/DateFormat.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Helper/ReactSelect.ts](../Energiepad/energiepadui/src/Helper/ReactSelect.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Helper/Year.ts](../Energiepad/energiepadui/src/Helper/Year.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Helper/country-currency.ts](../Energiepad/energiepadui/src/Helper/country-currency.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Helper/diffRecords.ts](../Energiepad/energiepadui/src/Helper/diffRecords.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Helper/increasedPercentage.ts](../Energiepad/energiepadui/src/Helper/increasedPercentage.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Helper/sectors.ts](../Energiepad/energiepadui/src/Helper/sectors.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Home.tsx](../Energiepad/energiepadui/src/Home.tsx) | Retire (proposed from SaaS shell) / Marketing content outside authenticated app / 1 |
| [Energiepad/energiepadui/src/Hooks/useConvertHtmlToImg.ts](../Energiepad/energiepadui/src/Hooks/useConvertHtmlToImg.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Hooks/useDidUpdateEffect.ts](../Energiepad/energiepadui/src/Hooks/useDidUpdateEffect.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Hooks/useQueryManager.ts](../Energiepad/energiepadui/src/Hooks/useQueryManager.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Layout.tsx](../Energiepad/energiepadui/src/Layout.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Login.tsx](../Energiepad/energiepadui/src/Login.tsx) | Replace / Identity and memberships / 1 |
| [Energiepad/energiepadui/src/Models/BuildingPattern.ts](../Energiepad/energiepadui/src/Models/BuildingPattern.ts) | Redesign / Drivers and operating history / 3 |
| [Energiepad/energiepadui/src/Models/Consumption.ts](../Energiepad/energiepadui/src/Models/Consumption.ts) | Redesign / Energy and units / 3–5 |
| [Energiepad/energiepadui/src/Models/Emission.ts](../Energiepad/energiepadui/src/Models/Emission.ts) | Redesign / Carbon / 5 |
| [Energiepad/energiepadui/src/Models/Floor.ts](../Energiepad/energiepadui/src/Models/Floor.ts) | Retain / Sites and meters / 2 |
| [Energiepad/energiepadui/src/Models/FuelSource.ts](../Energiepad/energiepadui/src/Models/FuelSource.ts) | Redesign / Energy and units / 3–5 |
| [Energiepad/energiepadui/src/Models/FuelUse.ts](../Energiepad/energiepadui/src/Models/FuelUse.ts) | Redesign / Energy and units / 3–5 |
| [Energiepad/energiepadui/src/Models/Login.ts](../Energiepad/energiepadui/src/Models/Login.ts) | Replace / Identity and memberships / 1 |
| [Energiepad/energiepadui/src/Models/Logs.ts](../Energiepad/energiepadui/src/Models/Logs.ts) | Redesign / Drivers and operating history / 3 |
| [Energiepad/energiepadui/src/Models/M_T.ts](../Energiepad/energiepadui/src/Models/M_T.ts) | Redesign / Targets and monitoring / 5 |
| [Energiepad/energiepadui/src/Models/Option.ts](../Energiepad/energiepadui/src/Models/Option.ts) | Replace / Typed application infrastructure / 1 |
| [Energiepad/energiepadui/src/Models/Register.ts](../Energiepad/energiepadui/src/Models/Register.ts) | Replace / Identity and memberships / 1 |
| [Energiepad/energiepadui/src/Models/Review.ts](../Energiepad/energiepadui/src/Models/Review.ts) | Redesign / Opportunities and evidence / 6 |
| [Energiepad/energiepadui/src/Models/Site.ts](../Energiepad/energiepadui/src/Models/Site.ts) | Retain / Sites and meters / 2 |
| [Energiepad/energiepadui/src/Models/Tarriff.ts](../Energiepad/energiepadui/src/Models/Tarriff.ts) | Redesign / Tariffs and tax / 3 |
| [Energiepad/energiepadui/src/Progress.tsx](../Energiepad/energiepadui/src/Progress.tsx) | Retire (proposed from SaaS shell) / Marketing content outside authenticated app / 1 |
| [Energiepad/energiepadui/src/Recognitions.tsx](../Energiepad/energiepadui/src/Recognitions.tsx) | Retire (proposed from SaaS shell) / Marketing content outside authenticated app / 1 |
| [Energiepad/energiepadui/src/Services/Auth.ts](../Energiepad/energiepadui/src/Services/Auth.ts) | Replace / Identity and memberships / 1 |
| [Energiepad/energiepadui/src/Services/BaseAxios.ts](../Energiepad/energiepadui/src/Services/BaseAxios.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Services/Business.ts](../Energiepad/energiepadui/src/Services/Business.ts) | Redesign / Organisation and onboarding / 1–2 |
| [Energiepad/energiepadui/src/Services/Review.ts](../Energiepad/energiepadui/src/Services/Review.ts) | Redesign / Opportunities and evidence / 6 |
| [Energiepad/energiepadui/src/Services/Site.ts](../Energiepad/energiepadui/src/Services/Site.ts) | Retain / Sites and meters / 2 |
| [Energiepad/energiepadui/src/Services/Utility.ts](../Energiepad/energiepadui/src/Services/Utility.ts) | Redesign / Energy and units / 3–5 |
| [Energiepad/energiepadui/src/Settings/BuildingEnergyLog.tsx](../Energiepad/energiepadui/src/Settings/BuildingEnergyLog.tsx) | Redesign / Drivers and operating history / 3 |
| [Energiepad/energiepadui/src/Settings/BuildingEnergyPatterns/BuildingEnergyPatterns.tsx](../Energiepad/energiepadui/src/Settings/BuildingEnergyPatterns/BuildingEnergyPatterns.tsx) | Redesign / Drivers and operating history / 3 |
| [Energiepad/energiepadui/src/Settings/BuildingEnergyPatterns/PatternInputSection.tsx](../Energiepad/energiepadui/src/Settings/BuildingEnergyPatterns/PatternInputSection.tsx) | Redesign / Drivers and operating history / 3 |
| [Energiepad/energiepadui/src/Settings/Business.tsx](../Energiepad/energiepadui/src/Settings/Business.tsx) | Redesign / Organisation and onboarding / 1–2 |
| [Energiepad/energiepadui/src/Settings/Comsumption/ConsumptionImportModal.tsx](../Energiepad/energiepadui/src/Settings/Comsumption/ConsumptionImportModal.tsx) | Replace / Data import / 2–3 |
| [Energiepad/energiepadui/src/Settings/Comsumption/SimpleImportModal.tsx](../Energiepad/energiepadui/src/Settings/Comsumption/SimpleImportModal.tsx) | Replace / Data import / 2–3 |
| [Energiepad/energiepadui/src/Settings/ReviewAndProgrammes.tsx](../Energiepad/energiepadui/src/Settings/ReviewAndProgrammes.tsx) | Redesign / Opportunities and evidence / 6 |
| [Energiepad/energiepadui/src/Settings/Settings.tsx](../Energiepad/energiepadui/src/Settings/Settings.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Settings/Sites.tsx](../Energiepad/energiepadui/src/Settings/Sites.tsx) | Retain / Sites and meters / 2 |
| [Energiepad/energiepadui/src/Settings/UtilityAndEmissions.tsx](../Energiepad/energiepadui/src/Settings/UtilityAndEmissions.tsx) | Redesign / Energy, Carbon and targets / 3, 5 |
| [Energiepad/energiepadui/src/Settings/buildingEnergyForm/BuildingEnergy.tsx](../Energiepad/energiepadui/src/Settings/buildingEnergyForm/BuildingEnergy.tsx) | Redesign / Energy and units / 3–5 |
| [Energiepad/energiepadui/src/Settings/buildingEnergyForm/FuelSourceInput.tsx](../Energiepad/energiepadui/src/Settings/buildingEnergyForm/FuelSourceInput.tsx) | Redesign / Energy and units / 3–5 |
| [Energiepad/energiepadui/src/Settings/buildingEnergyForm/FuelUseInput.tsx](../Energiepad/energiepadui/src/Settings/buildingEnergyForm/FuelUseInput.tsx) | Redesign / Energy and units / 3–5 |
| [Energiepad/energiepadui/src/State/ActionCreators/index.ts](../Energiepad/energiepadui/src/State/ActionCreators/index.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/State/ActionTypes/index.ts](../Energiepad/energiepadui/src/State/ActionTypes/index.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/State/Actions/index.ts](../Energiepad/energiepadui/src/State/Actions/index.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/State/Reducers/DisplayReducer.ts](../Energiepad/energiepadui/src/State/Reducers/DisplayReducer.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/State/Reducers/FuelReducer.ts](../Energiepad/energiepadui/src/State/Reducers/FuelReducer.ts) | Redesign / Energy and units / 3–5 |
| [Energiepad/energiepadui/src/State/Reducers/MonthReducer.ts](../Energiepad/energiepadui/src/State/Reducers/MonthReducer.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/State/Reducers/SiteReducer.ts](../Energiepad/energiepadui/src/State/Reducers/SiteReducer.ts) | Retain / Sites and meters / 2 |
| [Energiepad/energiepadui/src/State/Reducers/YearReducer.ts](../Energiepad/energiepadui/src/State/Reducers/YearReducer.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/State/Reducers/index.ts](../Energiepad/energiepadui/src/State/Reducers/index.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/State/index.ts](../Energiepad/energiepadui/src/State/index.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/State/store.ts](../Energiepad/energiepadui/src/State/store.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/Team.tsx](../Energiepad/energiepadui/src/Team.tsx) | Retire (proposed from SaaS shell) / Marketing content outside authenticated app / 1 |
| [Energiepad/energiepadui/src/UserManagement.tsx](../Energiepad/energiepadui/src/UserManagement.tsx) | Replace / Identity and memberships / 1 |
| [Energiepad/energiepadui/src/Work.tsx](../Energiepad/energiepadui/src/Work.tsx) | Retire (proposed from SaaS shell) / Marketing content outside authenticated app / 1 |
| [Energiepad/energiepadui/src/index.tsx](../Energiepad/energiepadui/src/index.tsx) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/react-app-env.d.ts](../Energiepad/energiepadui/src/react-app-env.d.ts) | Replace / Application shell and shared UI / 1 |
| [Energiepad/energiepadui/src/reportWebVitals.ts](../Energiepad/energiepadui/src/reportWebVitals.ts) | Redesign / Reports / 5, 7 |
| [Energiepad/energiepadui/src/setupTests.ts](../Energiepad/energiepadui/src/setupTests.ts) | Replace / Application shell and shared UI / 1 |

### Backend controllers and services

| Module | Declared functions | Disposition / destination / sprint |
| --- | --- | --- |
| [src/controllers/auth.controller.ts](../src/controllers/auth.controller.ts) | registerUser, loginUser | Replace / Identity and memberships / 1 |
| [src/controllers/conversionUnit.controller.ts](../src/controllers/conversionUnit.controller.ts) | getConversionUnitValues | Redesign / Energy and units / 3–5 |
| [src/controllers/dashboard.controller.ts](../src/controllers/dashboard.controller.ts) | consumptionToBreakdown, getDataByYear, getReporData, mapRecords, getcarbonFootprint, getPortfolioData, findSiteById, addSitesData, energyWaste, replaceSiteId, filterPassYear, reports, consumptionToBreakdown, replaceSiteId, filterPassYear | Redesign / Overview and site performance / 5 |
| [src/controllers/index.ts](../src/controllers/index.ts) | Class methods or module exports | Replace / Application shell and shared UI / 1 |
| [src/controllers/multi_adjustment_hdd.ts](../src/controllers/multi_adjustment_hdd.ts) | Class methods or module exports | Redesign / Baseline and Waste & Savings / 4–5 |
| [src/controllers/multi_nrv_hdd.ts](../src/controllers/multi_nrv_hdd.ts) | Class methods or module exports | Redesign / Baseline and Waste & Savings / 4–5 |
| [src/controllers/single_rv_hdd.ts](../src/controllers/single_rv_hdd.ts) | Class methods or module exports | Replace / Application shell and shared UI / 1 |
| [src/controllers/sites.controller.ts](../src/controllers/sites.controller.ts) | getSiteDetails, createSite, updateSite, deleteSite, getCountries, getStates, setSiteUnitConversion | Retain / Sites and meters / 2 |
| [src/controllers/user.controller.ts](../src/controllers/user.controller.ts) | updateUser, getMet, saveEnergy, getFuelSourceIds, getFuelUseIds, getBusinessEnergy, addLog, setTenants, setReviews, setProgrammes, getSites, setFloors, getBusinessFloors, savePattenrs, getPatterns, getLogs, importFile, importTenants, isString, importPatterns, isString | Redesign / Identity and organisation services / 1–2 |
| [src/controllers/utility.controller.ts](../src/controllers/utility.controller.ts) | addConsumption, addEmission, addMonitoring, importLog, importFile, getSavingTips, getFuelSources, getUses, getConsumptions, getEmissions, getMonitoring, getDuplicatesForComsumption, getDuplicatesForEmissionOrTargets, removeRowIdx, importUtilityEmissionFromFile, saveTipsMapping, getBusinessTips | Redesign / Energy and units / 3–5 |
| [src/lib/excel/BusinessExcelClient.ts](../src/lib/excel/BusinessExcelClient.ts) | getBusinessData, getSitesData, isValidSiteRow, getSitesRecords, getRows, readExcelFile | Replace / Data import / 2–3 |
| [src/lib/excel/LogExcelClient.ts](../src/lib/excel/LogExcelClient.ts) | getLogData, getRows, readExcelFile | Replace / Data import / 2–3 |
| [src/lib/excel/OperationsExcelClient.ts](../src/lib/excel/OperationsExcelClient.ts) | getPatternsData, getRows, readExcelFile | Replace / Data import / 2–3 |
| [src/lib/excel/TenantExcelClient.ts](../src/lib/excel/TenantExcelClient.ts) | getTenantData, getRows, readExcelFile | Replace / Data import / 2–3 |
| [src/lib/excel/UtilityEmissionExcelClient.ts](../src/lib/excel/UtilityEmissionExcelClient.ts) | getMonthByName, extractConsumptionData, extractEmissionsData, extractTargetData, readExcelFile | Replace / Data import / 2–3 |
| [src/lib/excel/UtilityExcelClient.ts](../src/lib/excel/UtilityExcelClient.ts) | getUtilityData, getConsumptions, getEmissions, getTargedData, getDriversData, getSetpointsData, readExcelFile | Replace / Data import / 2–3 |
| [src/lib/excel/index.ts](../src/lib/excel/index.ts) | Class methods or module exports | Replace / Data import / 2–3 |
| [src/services/auth.service.ts](../src/services/auth.service.ts) | registerUser, generateJwt | Replace / Identity and memberships / 1 |
| [src/services/conversionUnit.service.ts](../src/services/conversionUnit.service.ts) | findBy, getTargetConsumption | Redesign / Energy and units / 3–5 |
| [src/services/dashboard.service.ts](../src/services/dashboard.service.ts) | uniqueElements, populateByDateFromSite, populateArrayByDateSite, getConsumptionStatistics, getAverage, consumptionFilter, generateConsumptionDetail, getConsumptionDetails, generateMockConsumption, makeMapKey, produceYearConsumptions, consumptionIsProduced, consumptionIsNotProduced, wasteCost, findCarbonEmissions, filterResultForParamDate, findEmissionForConsumption, mapCarbonTarget, filterNull, wasteForSinglefuelFunction, getFuelSourcesFromConsumptionCollection, calculateWaste, wasteForPowerAndLightingAndCooling, filterLightingAndPowerConsumption, f, filterSingleConsumptionForHeatingOrCooling, f, calculateFinancialCost, calculateCarbonImpact, getSiteDrivers | Redesign / Overview and site performance / 5 |
| [src/services/greenDays.service.ts](../src/services/greenDays.service.ts) | makeRequest, base64urlEncode, random, handleResponse, dateRangeToBreakdownRange, isHdd, isCdd, getHdds, groupBySite, getHdds2 | Redesign / Drivers and operating history / 3 |
| [src/services/index.ts](../src/services/index.ts) | Class methods or module exports | Replace / Application shell and shared UI / 1 |
| [src/services/sites.service.ts](../src/services/sites.service.ts) | createSite, getSiteDetails, findBy, deleteById, getCountries, getStates, filterBySiteId, setSiteConversionUnits | Retain / Sites and meters / 2 |
| [src/services/timedate.service.ts](../src/services/timedate.service.ts) | Class methods or module exports | Redesign / Drivers and operating history / 3 |
| [src/services/user.service.ts](../src/services/user.service.ts) | getUserBy, reduceRecords, savePattern, getPatterns, deletePatters, updateUser, setBrands, saveEnergy, mapBrand, mapDistance, getBusinessEnergies, reduceRecords, reduceInnerRecord, mapEntries, saveLog, getLogs, setTenants, setReviews, reduceReviewsData, mapAnswerQuery, setProgrammes, reduceProgrammesData, mapAnswerQuery, setFloors, mapFloor, getFloorsBy, getTenantsBy | Redesign / Identity and organisation services / 1–2 |
| [src/services/utility.service.ts](../src/services/utility.service.ts) | addConsumptionToUtility, areConsumptionEqual, upsertConsumptionToUtility, upsertEmissions, upsertMonitoring, removeUsedIn, addMonitoringToUtility, getMonitoring, getSavingTips, mapEnergyTipToBusiness, getBusinessTips, deleteEmissionsBy, deleteConsumptionBy, asignDate, getEmissions, getConsumptions, getFuelSources, findFuelBy, findFuelUseBy, filterByUse, addUtilityEmissions, consumingProjection, filterByFuelSource, isOnUse, filterByIsOnUse | Redesign / Energy and units / 3–5 |
| [src/services/waste/test/multiRoutine.test.ts](../src/services/waste/test/multiRoutine.test.ts) | Class methods or module exports | Redesign / Baseline and Waste & Savings / 4–5 |
| [src/services/waste/test/multipleNRV.test.ts](../src/services/waste/test/multipleNRV.test.ts) | Class methods or module exports | Redesign / Baseline and Waste & Savings / 4–5 |
| [src/services/waste/test/singleRV.test.ts](../src/services/waste/test/singleRV.test.ts) | Class methods or module exports | Redesign / Baseline and Waste & Savings / 4–5 |
| [src/services/waste/test/waste.test.ts](../src/services/waste/test/waste.test.ts) | buildFakeConsumption | Redesign / Baseline and Waste & Savings / 4–5 |
| [src/services/waste/waste.service.ts](../src/services/waste/waste.service.ts) | linest3Variable, wasteSingleNrv, wasteMultiNrv, wasteMultiAdjustment, calculateWaste | Redesign / Baseline and Waste & Savings / 4–5 |
| [Energiepad/energeiapdapi/src/controllers/auth.controller.ts](../Energiepad/energeiapdapi/src/controllers/auth.controller.ts) | Class methods or module exports | Replace / Identity and memberships / 1 |
| [Energiepad/energeiapdapi/src/controllers/business.controller.ts](../Energiepad/energeiapdapi/src/controllers/business.controller.ts) | Class methods or module exports | Redesign / Organisation and onboarding / 1–2 |
| [Energiepad/energeiapdapi/src/controllers/index.controller.ts](../Energiepad/energeiapdapi/src/controllers/index.controller.ts) | Class methods or module exports | Replace / Application shell and shared UI / 1 |
| [Energiepad/energeiapdapi/src/controllers/users.controller.ts](../Energiepad/energeiapdapi/src/controllers/users.controller.ts) | Class methods or module exports | Replace / Identity and memberships / 1 |
| [Energiepad/energeiapdapi/src/controllers/utilities.controller.ts](../Energiepad/energeiapdapi/src/controllers/utilities.controller.ts) | Class methods or module exports | Replace / Application shell and shared UI / 1 |
| [Energiepad/energeiapdapi/src/services/auth.service.ts](../Energiepad/energeiapdapi/src/services/auth.service.ts) | signup, login, logout, createToken, createCookie | Replace / Identity and memberships / 1 |
| [Energiepad/energeiapdapi/src/services/business.service.ts](../Energiepad/energeiapdapi/src/services/business.service.ts) | findAllBusiness, findBusinessById, create, update, delete | Redesign / Organisation and onboarding / 1–2 |
| [Energiepad/energeiapdapi/src/services/users.service.ts](../Energiepad/energeiapdapi/src/services/users.service.ts) | findAllUser, findUserById, createUser, updateUser, deleteUser | Replace / Identity and memberships / 1 |
| [Energiepad/energeiapdapi/src/services/utilities.service.ts](../Energiepad/energeiapdapi/src/services/utilities.service.ts) | findAllUtilities, findUtilitiesById, create, update, delete | Replace / Application shell and shared UI / 1 |

## Existing tests and confidence

Root test/ covers auth, user/business, sites, utilities, dashboard, conversions and March 2025 end-use scenarios (single heating/cooling, lighting/power, heating/cooling, and combinations with power). src/services/waste/test/ contains singleRV, multiRoutine, multipleNRV and waste tests, many using exact rounded-value assertions. Nested API tests cover auth, users and index. UI has App smoke tests and Cypress appflow/business registration plus example suites. These are historical evidence, not proof of current passing coverage.

No legacy test suite was run: the root pretest tears down/starts Docker services and existing fixtures/environment are unverified. No security probing of a live service was performed. Sprint 1 must establish isolated tests; Sprint 4 must validate approved fixtures independently.

The discovery source manifest records paths and SHA-256 hashes (no file contents), including generated siblings and existing working-tree differences. Production schema, exact deployed JS/TS resolution, real user journeys and missing golden files remain external evidence gaps.

Discovery validation passed: all catalogue endpoint/request source references are present, relative documentation links and referenced line numbers resolve, all 564 source hashes remain unchanged, and the four NRA regression coefficients independently match cached coefficients within approximately 1.2e-15. That numerical comparison does not resolve the SStot formula/cache discrepancy or constitute full workbook approval.
