# Testing Setka

## 1. Start The App

Run:

```powershell
cd D:\work\IT\web_reps\Setka\app
npm start
```

Open:

```text
http://127.0.0.1:5177
```

If port `5177` is busy, stop the old `node` process or restart the dev server.

## 2. Test Students Manually

1. Open `Ученики`.
2. Click `Добавить ученика`.
3. Fill `ФИО`, optional nickname, direction, status, duration, start date, and notes.
4. Click `Сохранить`.
5. Confirm the student appears in the list.
6. Click the student and check the card.
7. Refresh the page.
8. Confirm the student is still there.
9. Click `Редактировать`, change a field, and save.
10. Confirm the card changed.

This checks the student CRUD flow and IndexedDB persistence.

## 3. Test Schedule Manually

1. Add at least one student on `Ученики`.
2. Open `Расписание`.
3. Confirm the student appears in the right panel.
4. Drag the student into a grid cell.
5. Refresh the page.
6. Open `Расписание` again and confirm the assignment remains.
7. Click `Новое расписание` and confirm a second plan appears as a tab.
8. Click `Дублировать` and confirm the current plan is copied.
9. Enable `Раскраска`, choose `Зеленый`, `Желтый`, `Красный`, or `Синий`, and click empty cells.
10. Enable `Скрыть имена` and click `Скачать HTML`.
11. Open the downloaded `schedule-export.html` and confirm names are hidden where expected.
12. Click `Текст для родителей` and paste into any text editor to confirm free windows were copied.

## 4. Test GitHub Pages Export

Safe local export:

1. Open `Расписание`.
2. Click `Сохранить в dist`.
3. Confirm the success alert.
4. Check that `D:\work\IT\web_reps\Setka\schedule\dist\index.html` was updated.

Publishing:

1. Make sure `D:\work\IT\web_reps\Setka\schedule` is connected to the correct GitHub repository.
2. Make sure `schedule/deploy.bat` commits and pushes to the branch used by GitHub Pages.
3. Open `Расписание`.
4. Click `Опубликовать GitHub Pages`.
5. Confirm the prompt.
6. Wait for GitHub Actions / Pages to publish.

Publishing runs local git commands through `schedule/deploy.bat`, so it depends on your GitHub credentials and repository setup.

## 5. Run Automated Tests

Unit tests:

```powershell
cd D:\work\IT\web_reps\Setka\app
npm test
```

End-to-end browser tests:

```powershell
cd D:\work\IT\web_reps\Setka\app
npm run test:e2e
```

The e2e suite checks:

- creating a student through the UI;
- keeping the student after reload;
- opening the native schedule builder;
- dragging a student into a schedule slot;
- keeping the schedule assignment after reload;
- downloading the schedule HTML export.

## 6. Where Local Data Lives

Setka data is in browser IndexedDB:

- database: `setka-local-db`;
- stores: `students`, `schedulePlans`, `changeLogs`, and future domain stores.

The old planner is still available at `/legacy-schedule/schedule.html` and uses:

- localStorage key: `teacher_schedule_builder_multi_v2`.

The new native schedule builder does not depend on that old localStorage key.

