import { migrateIndexedDbToServerIfNeeded } from './data/browserMigration.js';
import { startApp } from './ui/app.js';

const root = document.querySelector('#app');

async function boot() {
  try {
    await migrateIndexedDbToServerIfNeeded();
    startApp(root);
  } catch (error) {
    root.innerHTML = `
      <main class="fatal-error">
        <h1>Не удалось открыть локальную базу</h1>
        <p>${error.message}</p>
      </main>
    `;
  }
}

boot();
