import { expect, test } from '@playwright/test';

test('creates a student and keeps it after reload', async ({ page }) => {
  const fullName = `Тестовый Ученик ${Date.now()}`;
  const customDirection = `Arduino ${Date.now()}`;

  await page.goto('/');
  await page.getByRole('button', { name: 'Добавить ученика' }).click();
  await page.getByLabel('ФИО').fill(fullName);
  await page.getByLabel('Псевдоним').fill('Тест');
  await page.getByLabel('Направление', { exact: true }).selectOption('__add_new__');
  await page.getByLabel('Новое направление').fill(customDirection);
  await page.getByLabel('Телефон (основной)').fill('+7 999 123-45-67');
  await page.getByLabel('Telegram').fill('@setka_test');
  await page.getByLabel('VK').fill('vk.com/setka_test');
  await page.getByRole('button', { name: 'Сохранить' }).click();

  await expect(page.getByRole('button', { name: new RegExp(fullName) })).toBeVisible();
  await expect(page.getByRole('heading', { name: fullName })).toBeVisible();
  await expect(page.locator('.details-panel .detail-item', { hasText: customDirection })).toBeVisible();
  await expect(page.getByRole('link', { name: /Телефон/ })).toHaveAttribute('href', 'tel:+79991234567');
  await expect(page.getByRole('link', { name: /Telegram/ })).toHaveAttribute('href', 'https://t.me/setka_test');

  await page.reload();

  await page.getByRole('button', { name: new RegExp(fullName) }).click();
  await expect(page.getByRole('heading', { name: fullName })).toBeVisible();
  await expect(page.getByRole('link', { name: /VK/ })).toHaveAttribute('href', 'https://vk.com/setka_test');
});
