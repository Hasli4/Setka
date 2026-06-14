import { deleteStoreItem, getStoreItem, listStore, putStoreItem, replaceStore } from './apiClient.js';
import { STORES } from './schema.js';

const SCHEDULE_UI_SETTINGS_KEY = 'schedule.ui';

export async function listSchedulePlans() {
  const plans = await listStore(STORES.schedulePlans);

  return plans.sort((first, second) => first.createdAt.localeCompare(second.createdAt));
}

export async function getSchedulePlan(id) {
  return getStoreItem(STORES.schedulePlans, id);
}

export async function saveSchedulePlan(plan) {
  await putStoreItem(STORES.schedulePlans, plan);
}

export async function replaceSchedulePlans(plans) {
  await replaceStore(STORES.schedulePlans, plans);
}

export async function deleteSchedulePlan(id) {
  await deleteStoreItem(STORES.schedulePlans, id);
}

export async function getScheduleUiSettings() {
  const settings = await getStoreItem(STORES.appSettings, SCHEDULE_UI_SETTINGS_KEY);

  return settings?.value ?? {};
}

export async function saveScheduleUiSettings(value) {
  await putStoreItem(STORES.appSettings, {
    key: SCHEDULE_UI_SETTINGS_KEY,
    value,
    updatedAt: new Date().toISOString(),
  });
}
