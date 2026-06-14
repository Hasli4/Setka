import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const defaultHost = '127.0.0.1';
const defaultPort = Number(process.env.PORT || 5177);
const root = resolve(import.meta.dirname);
const dataRoot = resolve(process.env.SETKA_DATA_ROOT || join(root, '.setka-data'));
const dataFile = resolve(join(dataRoot, 'setka-db.json'));
const legacyScheduleRoot = resolve(join(root, '..', 'schedule'));
const legacyScheduleDist = resolve(join(legacyScheduleRoot, 'dist'));
const legacyScheduleIndex = resolve(join(legacyScheduleDist, 'index.html'));
const legacyDeployScript = resolve(join(legacyScheduleRoot, 'deploy.bat'));
let activeHost = defaultHost;
let activePort = defaultPort;
let writeQueue = Promise.resolve();

const storeNames = Object.freeze([
  'students',
  'parentContacts',
  'studentParentContacts',
  'lessons',
  'subscriptions',
  'schedulePlans',
  'scheduleSlots',
  'messageTemplates',
  'syncLogs',
  'changeLogs',
  'appSettings',
]);

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
]);

function resolveAsset(url) {
  const requestedPath = decodeURIComponent(new URL(url, `http://${activeHost}:${activePort}`).pathname);

  if (requestedPath === '/legacy-schedule' || requestedPath.startsWith('/legacy-schedule/')) {
    const legacyRelativePath = requestedPath.replace(/^\/legacy-schedule\/?/, '') || 'schedule.html';
    const cleanLegacyPath = normalize(legacyRelativePath).replace(/^(\.\.[/\\])+/, '');
    const candidate = resolve(join(legacyScheduleRoot, cleanLegacyPath));
    const isPrivatePath = /(^|[/\\])(\.git|node_modules|backup)([/\\]|$)/.test(candidate);

    if (!candidate.startsWith(legacyScheduleRoot) || isPrivatePath) {
      return null;
    }

    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }

    return null;
  }

  const cleanPath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  const candidate = resolve(join(root, cleanPath === '/' ? 'index.html' : cleanPath));

  if (!candidate.startsWith(root)) {
    return null;
  }

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  return resolve(join(root, 'index.html'));
}

function createSetkaServer() {
  return createServer(async (request, response) => {
    try {
      if (await handleApi(request, response)) {
        return;
      }

  if (request.method === 'POST' && request.url === '/api/schedule/export-site') {
    handleExportSite(request, response);
    return;
  }

  if (request.method === 'POST' && request.url === '/api/schedule/publish-github-pages') {
    handlePublishGithubPages(request, response);
    return;
  }

  const assetPath = resolveAsset(request.url ?? '/');

  if (!assetPath || !existsSync(assetPath)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': contentTypes.get(extname(assetPath)) ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });

  createReadStream(assetPath).pipe(response);
    } catch (error) {
      sendJson(response, 500, { ok: false, error: String(error.message || error) });
    }
  });
}

export function startServer({ host = defaultHost, port = defaultPort, allowFallback = false } = {}) {
  activeHost = host;
  activePort = port;
  const server = createSetkaServer();

  return new Promise((resolveServer, rejectServer) => {
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE' && allowFallback && port !== 0) {
        startServer({ host, port: 0, allowFallback: false }).then(resolveServer, rejectServer);
        return;
      }

      rejectServer(error);
    });

    server.listen(port, host, () => {
      activePort = server.address().port;
      resolveServer({
        server,
        host,
        port: activePort,
        url: `http://${host}:${activePort}`,
      });
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer()
    .then(({ url }) => {
      console.log(`Setka is running at ${url}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

async function handleApi(request, response) {
  const url = new URL(request.url ?? '/', `http://${activeHost}:${activePort}`);
  const segments = url.pathname.split('/').filter(Boolean);

  if (segments[0] !== 'api') {
    return false;
  }

  if (segments[1] === 'stores') {
    await handleStoreApi(request, response, segments);
    return true;
  }

  if (segments[1] === 'state' && request.method === 'GET') {
    sendJson(response, 200, { ok: true, state: await readState() });
    return true;
  }

  if (segments[1] === 'state' && segments[2] === 'import-browser' && request.method === 'POST') {
    const payload = await readJsonBody(request);
    const result = await importBrowserState(payload);
    sendJson(response, 200, { ok: true, ...result });
    return true;
  }

  return false;
}

async function handleStoreApi(request, response, segments) {
  const storeName = segments[2];

  if (!storeNames.includes(storeName)) {
    sendJson(response, 404, { ok: false, error: 'Unknown store.' });
    return;
  }

  if (segments[3] === 'replace' && request.method === 'POST') {
    const { items } = await readJsonBody(request);

    if (!Array.isArray(items)) {
      sendJson(response, 400, { ok: false, error: 'items must be an array.' });
      return;
    }

    await mutateState((state) => {
      state.stores[storeName] = items;
      return { count: items.length };
    });
    sendJson(response, 200, { ok: true, count: items.length });
    return;
  }

  const itemId = segments[3] ? decodeURIComponent(segments.slice(3).join('/')) : null;

  if (request.method === 'GET' && !itemId) {
    const state = await readState();
    sendJson(response, 200, { ok: true, items: state.stores[storeName] ?? [] });
    return;
  }

  if (request.method === 'GET' && itemId) {
    const state = await readState();
    const item = findStoreItem(state.stores[storeName] ?? [], storeName, itemId);

    if (!item) {
      sendJson(response, 404, { ok: false, error: 'Item not found.' });
      return;
    }

    sendJson(response, 200, { ok: true, item });
    return;
  }

  if (request.method === 'PUT') {
    const { item } = await readJsonBody(request);

    if (!item || typeof item !== 'object') {
      sendJson(response, 400, { ok: false, error: 'item is required.' });
      return;
    }

    const key = getStoreItemKey(storeName, item);

    if (!key) {
      sendJson(response, 400, { ok: false, error: 'item id is required.' });
      return;
    }

    const saved = await mutateState((state) => {
      const items = state.stores[storeName] ?? [];
      const index = items.findIndex((candidate) => getStoreItemKey(storeName, candidate) === key);

      if (index >= 0) {
        items[index] = item;
      } else {
        items.push(item);
      }

      state.stores[storeName] = items;
      return item;
    });
    sendJson(response, 200, { ok: true, item: saved });
    return;
  }

  if (request.method === 'DELETE' && itemId) {
    await mutateState((state) => {
      state.stores[storeName] = (state.stores[storeName] ?? []).filter(
        (item) => getStoreItemKey(storeName, item) !== itemId,
      );
      return null;
    });
    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 405, { ok: false, error: 'Method not allowed.' });
}

async function importBrowserState(payload) {
  const incomingStores = payload?.stores && typeof payload.stores === 'object' ? payload.stores : {};

  return mutateState((state) => {
    const hasCentralData = ['students', 'schedulePlans', 'changeLogs'].some((storeName) => state.stores[storeName]?.length);

    if (hasCentralData) {
      return { imported: false, reason: 'central-data-exists' };
    }

    for (const storeName of storeNames) {
      if (Array.isArray(incomingStores[storeName])) {
        state.stores[storeName] = incomingStores[storeName];
      }
    }

    return { imported: true };
  });
}

async function readState() {
  await mkdir(dataRoot, { recursive: true });

  if (!existsSync(dataFile)) {
    return createEmptyState();
  }

  try {
    return normalizeState(JSON.parse(await readFile(dataFile, 'utf8')));
  } catch {
    return createEmptyState();
  }
}

async function mutateState(updater) {
  const writeOperation = writeQueue.then(async () => {
    const state = await readState();
    const result = await updater(state);
    state.updatedAt = new Date().toISOString();
    await writeState(state);
    return result;
  });

  writeQueue = writeOperation.catch(() => {});
  return writeOperation;
}

async function writeState(state) {
  await mkdir(dataRoot, { recursive: true });
  const tempFile = `${dataFile}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  await writeFile(tempFile, JSON.stringify(normalizeState(state), null, 2), 'utf8');
  await replaceStateFile(tempFile);
}

async function replaceStateFile(tempFile) {
  const retryableCodes = new Set(['EBUSY', 'EPERM', 'EACCES']);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rename(tempFile, dataFile);
      return;
    } catch (error) {
      if (!retryableCodes.has(error.code) || attempt === 7) {
        throw error;
      }

      await delay(25 * (attempt + 1));
    }
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function createEmptyState() {
  return normalizeState({
    version: 1,
    updatedAt: new Date().toISOString(),
    stores: {},
  });
}

function normalizeState(state) {
  const normalized = {
    version: Number(state?.version || 1),
    updatedAt: state?.updatedAt || new Date().toISOString(),
    stores: {},
  };

  for (const storeName of storeNames) {
    normalized.stores[storeName] = Array.isArray(state?.stores?.[storeName]) ? state.stores[storeName] : [];
  }

  return normalized;
}

function findStoreItem(items, storeName, itemId) {
  return items.find((item) => getStoreItemKey(storeName, item) === itemId) ?? null;
}

function getStoreItemKey(storeName, item) {
  return storeName === 'appSettings' ? item?.key : item?.id;
}

async function handleExportSite(request, response) {
  try {
    const { html } = await readJsonBody(request);

    if (!html || typeof html !== 'string') {
      sendJson(response, 400, { ok: false, error: 'HTML is required.' });
      return;
    }

    await writeScheduleHtml(html);
    sendJson(response, 200, { ok: true, path: legacyScheduleIndex });
  } catch (error) {
    sendJson(response, 500, { ok: false, error: String(error.message || error) });
  }
}

async function handlePublishGithubPages(request, response) {
  try {
    const { html } = await readJsonBody(request);

    if (!html || typeof html !== 'string') {
      sendJson(response, 400, { ok: false, error: 'HTML is required.' });
      return;
    }

    if (!existsSync(legacyDeployScript)) {
      sendJson(response, 404, { ok: false, error: 'deploy.bat was not found in schedule/.' });
      return;
    }

    await writeScheduleHtml(html);
    const result = await runDeployScript();
    sendJson(response, result.ok ? 200 : 500, result);
  } catch (error) {
    sendJson(response, 500, { ok: false, error: String(error.message || error) });
  }
}

async function writeScheduleHtml(html) {
  await mkdir(legacyScheduleDist, { recursive: true });
  await writeFile(legacyScheduleIndex, html, 'utf8');
}

function runDeployScript() {
  return new Promise((resolve) => {
    execFile('cmd.exe', ['/c', legacyDeployScript], { cwd: legacyScheduleRoot }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, error: String(error), stdout, stderr });
        return;
      }

      resolve({ ok: true, stdout, stderr, path: legacyScheduleIndex });
    });
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;

      if (body.length > 5_000_000) {
        request.destroy();
        reject(new Error('Request body is too large.'));
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}
