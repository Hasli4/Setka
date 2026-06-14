import { importBrowserState, getServerState } from './apiClient.js';
import { requestToPromise, withStore } from './database.js';
import { STORES } from './schema.js';

const MIGRATION_DONE_KEY = 'setka.indexedDbToServerMigrationDone';
const importantStores = ['students', 'schedulePlans', 'changeLogs'];

export async function migrateIndexedDbToServerIfNeeded() {
  if (localStorage.getItem(MIGRATION_DONE_KEY) === 'true') {
    return;
  }

  const serverState = await getServerState();
  const hasServerData = importantStores.some((storeName) => serverState.stores?.[storeName]?.length);

  if (hasServerData) {
    localStorage.setItem(MIGRATION_DONE_KEY, 'true');
    return;
  }

  try {
    const stores = await readBrowserStores();
    const hasBrowserData = importantStores.some((storeName) => stores[storeName]?.length);

    if (!hasBrowserData) {
      localStorage.setItem(MIGRATION_DONE_KEY, 'true');
      return;
    }

    const result = await importBrowserState(stores);

    if (result.imported || result.reason === 'central-data-exists') {
      localStorage.setItem(MIGRATION_DONE_KEY, 'true');
    }
  } catch (error) {
    console.warn('IndexedDB migration was skipped:', error);
  }
}

async function readBrowserStores() {
  const stores = {};

  for (const storeName of Object.values(STORES)) {
    stores[storeName] = await withStore(storeName, 'readonly', (store) => requestToPromise(store.getAll()));
  }

  return stores;
}
