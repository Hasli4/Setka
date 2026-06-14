# Setka Architecture

## Stack

The current implementation is a local web app:

- Node.js serves the app and local export endpoints.
- IndexedDB is the local source of truth.
- Plain JavaScript ES modules keep the app easy to inspect and migrate.
- Playwright covers browser smoke tests.

Flutter + Drift remains a reasonable future shell for desktop and Android, but Flutter/Dart are not installed in this workspace. The current layers keep that migration possible.

## Project Structure

- `app/src/domain`: pure domain rules and constants.
- `app/src/data`: IndexedDB schema and repositories.
- `app/src/services`: use cases, export builders, and orchestration.
- `app/src/ui`: screens, forms, and DOM rendering.
- `app/tests`: unit and e2e tests.
- `schedule/`: previous standalone planner, still available as a reference and publication target.

## Database

IndexedDB database: `setka-local-db`, version `2`.

Stores:

- `students`
- `parentContacts`
- `studentParentContacts`
- `lessons`
- `subscriptions`
- `schedulePlans`
- `scheduleSlots`
- `messageTemplates`
- `syncLogs`
- `changeLogs`
- `appSettings`

`students` powers the student CRM. `schedulePlans` powers the native schedule builder. `changeLogs` records local changes for future sync/history.

## Native Schedule Builder

The current `Расписание` screen is native Setka UI, not an iframe.

It supports:

- multiple schedule plans;
- duplicate and delete plan;
- comparison mode;
- timezone display;
- hide names for public export;
- include/exclude plan from export;
- color marking for free windows;
- drag/drop students from the main student database;
- moving and clearing assigned slots;
- parent text generation;
- HTML download;
- saving public HTML to `schedule/dist/index.html`;
- publishing through `schedule/deploy.bat`.

The old planner remains available at `/legacy-schedule/schedule.html`. It is no longer the main schedule module.

## Export And GitHub Pages

`app/src/services/scheduleExportService.js` builds public HTML from Setka data.

`app/server.mjs` exposes:

- `POST /api/schedule/export-site`: writes generated HTML to `schedule/dist/index.html`.
- `POST /api/schedule/publish-github-pages`: writes generated HTML and runs `schedule/deploy.bat`.

Publishing depends on the nested `schedule` repository being correctly configured for GitHub Pages.

## Lesson Charge Rule

The initial charging rule lives in `app/src/domain/lessonChargePolicy.js`.

- `done` charges a subscription when automatic charging is enabled.
- `cancelled`, `frozen`, and `moved` do not charge by default.
- already charged lessons are not charged again.

This logic is pure so lesson/subscription repositories can reuse it later without UI changes.

