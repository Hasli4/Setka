import { expect, test } from '@playwright/test';

test('builds a native schedule with Setka students', async ({ page }) => {
  const fullName = `Сетка Ученик ${Date.now()}`;
  const nickname = `Сетка${Date.now()}`;

  await page.goto('/');
  await page.getByRole('button', { name: 'Добавить ученика' }).click();
  await page.getByLabel('ФИО').fill(fullName);
  await page.getByLabel('Псевдоним').fill(nickname);
  await page.getByLabel('Длительность занятия, минут').fill('90');
  await page.locator('.regular-lesson-row').first().getByLabel('День недели').selectOption('tue');
  await page.locator('.regular-lesson-row').first().getByLabel('Время МСК').selectOption('08:00');
  await page.getByLabel('Стоимость абонемента').fill('8000');
  await page.getByLabel('Занятий в абонементе').fill('8');
  await page.getByRole('button', { name: 'Сохранить' }).click();

  await page.getByRole('button', { name: 'Расписание', exact: true }).click();
  await page.getByRole('button', { name: 'Новое расписание' }).click();

  await expect(page.getByRole('heading', { name: 'Расписание', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Старый планировщик' })).toHaveCount(0);
  await expect(page.locator('.schedule-student-chip', { hasText: nickname })).toBeVisible();
  await expect(page.locator('[data-slot-key="tue_8"]')).toContainText(nickname);
  await expect(page.locator('[data-slot-key="tue_8"]')).toContainText('90 мин');
  await expect(page.locator('[data-slot-key="tue_8"]')).not.toContainText(fullName);

  await page.locator('[data-slot-key="tue_8"] .assignment-block').dragTo(page.locator('[data-slot-key="wed_9"]'));
  await expect(page.locator('[data-slot-key="wed_9"]')).toContainText(nickname);

  await page.locator('[data-slot-key="wed_9"] .assignment-block').click();
  await expect(page.getByRole('heading', { name: fullName })).toBeVisible();
  await expect(page.locator('.regular-lessons-view')).toContainText('Ср 09:00 - 90 мин');
  await expect(page.locator('.billing-view')).toContainText('1 000');

  await page.getByRole('button', { name: 'Расписание', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Расписание', exact: true }).click();
  await expect(page.locator('[data-slot-key="wed_9"]')).toContainText(nickname);

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
