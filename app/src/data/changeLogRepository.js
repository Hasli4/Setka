import { listStore, putStoreItem } from './apiClient.js';
import { STORES } from './schema.js';

export async function addChangeLog(entry) {
  await putStoreItem(STORES.changeLogs, {
    id: crypto.randomUUID(),
    source: 'local-ui',
    changedAt: new Date().toISOString(),
    status: 'pending',
    conflict: false,
    result: '',
    ...entry,
  });
}

export async function listChangeLogs(limit = 20) {
  const logs = await listStore(STORES.changeLogs);

  return logs
    .sort((first, second) => second.changedAt.localeCompare(first.changedAt))
    .slice(0, limit);
}
