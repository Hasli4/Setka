import { expect, test } from '@playwright/test';

async function createStudent(page, { fullName, nickname, duration = '60', weekday = '', startTime = '' }) {
  await page.locator('.page-header .primary-button').click();
  await page.locator('dialog input[name="fullName"]').fill(fullName);
  await page.locator('dialog input[name="nickname"]').fill(nickname);
  await page.locator('dialog input[name="defaultLessonDurationMinutes"]').fill(duration);
  await page.locator('dialog select[name="lessonWeekday"]').first().selectOption(weekday);
  await page.locator('dialog select[name="lessonStartTime"]').first().selectOption(startTime);
  await page.locator('dialog .primary-button').click();
  await expect(page.locator('dialog')).toHaveCount(0);
}

test('builds a native schedule with Setka students', async ({ page }) => {
  const fullName = `Сетка Ученик ${Date.now()}`;
  const nickname = `Сетка${Date.now()}`;

  await page.goto('/');
  await page.getByRole('button', { name: 'Добавить ученика' }).click();
  await page.getByLabel('ФИО').fill(fullName);
  await page.getByLabel('Псевдоним').fill(nickname);
  await page.getByLabel('Длительность занятия, минут').fill('90');
  await page.locator('.regular-lesson-row').first().getByLabel('День недели').selectOption('tue');
  await page.locator('.regular-lesson-row').first().getByLabel('Время МСК').selectOption('08:30');
  await page.getByLabel('Стоимость абонемента').fill('8000');
  await page.getByLabel('Занятий в абонементе').fill('8');
  await page.getByRole('button', { name: 'Сохранить' }).click();

  await page.getByRole('button', { name: 'Расписание', exact: true }).click();
  await page.getByRole('button', { name: 'Новое расписание' }).click();

  await expect(page.getByRole('heading', { name: 'Расписание', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Старый планировщик' })).toHaveCount(0);
  await expect(page.locator('.schedule-student-chip', { hasText: nickname })).toBeVisible();
  await expect(page.locator('.assignment-overlay-slot[data-overlay-slot-key="tue_8_30"]')).toContainText(nickname);
  await expect(page.locator('.assignment-overlay-slot[data-overlay-slot-key="tue_8_30"] .assignment-block')).not.toContainText('мин');
  const startingAssignment = page.locator('.assignment-overlay-slot[data-overlay-slot-key="tue_8_30"] .assignment-block');
  const startingAssignmentName = startingAssignment.locator('strong');
  await expect(startingAssignmentName).toHaveText(nickname);
  await expect(startingAssignmentName).toHaveCSS('text-overflow', 'clip');
  await expect(startingAssignmentName).toHaveCSS('white-space', 'normal');
  await expect(page.locator('.slot-half[data-slot-key="tue_8_30"]')).not.toContainText(fullName);

  const assignmentBox = await startingAssignment.boundingBox();
  const halfSlotBox = await page.locator('.slot-half[data-slot-key="tue_8_30"]').boundingBox();

  if (!assignmentBox || !halfSlotBox) {
    throw new Error('Не удалось измерить блок занятия.');
  }

  expect(assignmentBox.height).toBeGreaterThan(halfSlotBox.height * 2.5);
  expect(assignmentBox.width).toBeLessThanOrEqual(halfSlotBox.width + 2);
  expect(assignmentBox.x).toBeGreaterThanOrEqual(halfSlotBox.x - 2);
  expect(assignmentBox.x).toBeLessThanOrEqual(halfSlotBox.x + 8);
  await expect(page.locator('.native-slot[data-hour-key="tue_8"]')).toHaveCSS('background-image', 'none');
  await expect(page.locator('.native-slot[data-hour-key="tue_9"]')).toHaveClass(/covered-by-lesson/);
  await expect(startingAssignment).toHaveCSS('background-image', /repeating-linear-gradient/);
  await expect(startingAssignment).toHaveCSS('z-index', '60');
  await expect(page.locator('.slot-half[data-slot-key="tue_9"]')).not.toContainText('Пусто');

  await page.locator('.assignment-overlay-slot[data-overlay-slot-key="tue_8_30"] .assignment-block').dragTo(page.locator('.slot-half[data-slot-key="wed_9_30"]'));
  await expect(page.locator('.assignment-overlay-slot[data-overlay-slot-key="wed_9_30"]')).toContainText(nickname);

  await page.locator('.assignment-overlay-slot[data-overlay-slot-key="wed_9_30"] .assignment-block').click();
  await expect(page.getByRole('heading', { name: fullName })).toBeVisible();
  await expect(page.locator('.regular-lessons-view')).toContainText('Ср 09:30 - 90 мин');
  await expect(page.locator('.billing-view')).toContainText('1 000');

  await page.getByRole('button', { name: 'Расписание', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Расписание', exact: true }).click();
  await expect(page.locator('.assignment-overlay-slot[data-overlay-slot-key="wed_9_30"]')).toContainText(nickname);

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Скачать HTML' }).click({ noWaitAfter: true }),
  ]);

  expect(download.suggestedFilename()).toBe('schedule-export.html');

  const [backupDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Экспорт данных' }).click({ noWaitAfter: true }),
  ]);

  expect(backupDownload.suggestedFilename()).toMatch(/^setka-schedule-backup-\d{4}-\d{2}-\d{2}\.json$/);
});

test('allows the same clock time on different weekdays', async ({ page }) => {
  const stamp = Date.now();
  const busyNickname = `Busy${stamp}`;
  const movedNickname = `Mark${stamp}`;
  const dialogs = [];

  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await page.goto('/');
  await createStudent(page, {
    fullName: `Busy Student ${stamp}`,
    nickname: busyNickname,
    weekday: 'tue',
    startTime: '10:00',
  });
  await createStudent(page, {
    fullName: `Mark Student ${stamp}`,
    nickname: movedNickname,
    weekday: 'sun',
    startTime: '12:00',
  });

  await page.locator('.nav-button[data-screen="schedule"]').click();
  await page.getByRole('button', { name: 'Новое расписание' }).click();
  await expect(page.locator('.assignment-overlay-slot[data-overlay-slot-key="tue_10"]')).toContainText(busyNickname);
  await expect(page.locator('.assignment-overlay-slot[data-overlay-slot-key="sun_12"]')).toContainText(movedNickname);

  await page.locator('.assignment-overlay-slot[data-overlay-slot-key="sun_12"] .assignment-block').dragTo(page.locator('.slot-half[data-slot-key="sun_10"]'));

  await expect(page.locator('.assignment-overlay-slot[data-overlay-slot-key="sun_10"]')).toContainText(movedNickname);
  await expect(page.locator('.assignment-overlay-slot[data-overlay-slot-key="sun_12"]')).toHaveCount(0);
  expect(dialogs).toEqual([]);
});

test('adds a one-off lesson directly to a schedule', async ({ page }) => {
  const stamp = Date.now();
  const fullName = `One Off Student ${stamp}`;
  const nickname = `OneOff${stamp}`;

  await page.goto('/');
  await createStudent(page, {
    fullName,
    nickname,
  });

  await page.locator('.nav-button[data-screen="schedule"]').click();
  await page.getByRole('button', { name: 'Новое расписание' }).click();
  await page.locator('.schedule-student-chip', { hasText: nickname }).click();
  await page.locator('.slot-half[data-slot-key="mon_8_30"]').click();

  await expect(page.locator('.lesson-kind-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Разовое' }).click();

  await expect(page.locator('.assignment-overlay-slot[data-overlay-slot-key="mon_8_30"]')).toContainText(nickname);
  await page.locator('.assignment-overlay-slot[data-overlay-slot-key="mon_8_30"] .assignment-block').click();
  await expect(page.getByRole('heading', { name: fullName })).toBeVisible();
  await expect(page.locator('.regular-lessons-view')).toHaveCount(0);
});
