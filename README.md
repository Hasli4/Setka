# Setka

Local-first workspace for a programming and robotics teacher: students, local data, weekly schedules, subscriptions, lessons, and future sync.

## Stack

- Runtime: local web app served by Node.js.
- Storage: IndexedDB in the browser as the local source of truth.
- Architecture: separated `domain`, `data`, `services`, and `ui` layers.
- Schedule export: generated HTML can be downloaded, saved into `schedule/dist/index.html`, or published through the existing `schedule/deploy.bat`.

Flutter + Drift is still a good long-term target for a cross-platform shell, but Flutter/Dart are not installed in this workspace. The current implementation keeps the data and business layers isolated so the storage/UI shell can be migrated later.

## Run

```powershell
cd D:\work\IT\web_reps\Setka\app
npm start
```

Open:

```text
http://127.0.0.1:5177
```

## Test

```powershell
cd D:\work\IT\web_reps\Setka\app
npm test
npm run test:e2e
```

## What Works Now

- Student list, create, edit, view, delete.
- Student data persists after browser reload.
- Change log entries are written for student and schedule changes.
- Lesson charging policy is implemented as domain logic.
- Native schedule builder is integrated with Setka students.
- Schedule plans are stored in IndexedDB, not in the old planner's `localStorage`.
- Schedule supports multiple plans, duplication, deletion, comparison, timezones, hidden names, color marking, drag/drop student assignments, parent text, and HTML export.
- The previous standalone planner is still available at `/legacy-schedule/schedule.html` as a reference/fallback.

## Schedule Builder

Open `Расписание` in the app.

The new builder uses students from the main `Ученики` screen. Drag a student from the right panel into a weekly grid cell. Enable `Раскраска` to mark empty cells with green/yellow/red/blue priority colors. Use `Скрыть имена` when exporting a public version without student names.

Export options:

- `Скачать HTML`: downloads `schedule-export.html`.
- `Сохранить в dist`: writes the public page to `schedule/dist/index.html`.
- `Опубликовать GitHub Pages`: writes `schedule/dist/index.html` and runs `schedule/deploy.bat`.

GitHub Pages publishing is possible if the `schedule` folder is a configured git repository with a valid remote and credentials for `git push`.

