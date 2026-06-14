export async function listStore(storeName) {
  const payload = await apiRequest(`/api/stores/${encodeURIComponent(storeName)}`);
  return payload.items ?? [];
}

export async function getStoreItem(storeName, id) {
  try {
    const payload = await apiRequest(`/api/stores/${encodeURIComponent(storeName)}/${encodeURIComponent(id)}`);
    return payload.item ?? null;
  } catch (error) {
    if (error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function putStoreItem(storeName, item) {
  const key = storeName === 'appSettings' ? item.key : item.id;
  const payload = await apiRequest(`/api/stores/${encodeURIComponent(storeName)}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ item }),
  });

  return payload.item;
}

export async function deleteStoreItem(storeName, id) {
  await apiRequest(`/api/stores/${encodeURIComponent(storeName)}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function replaceStore(storeName, items) {
  await apiRequest(`/api/stores/${encodeURIComponent(storeName)}/replace`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export async function getServerState() {
  const payload = await apiRequest('/api/state');
  return payload.state;
}

export async function importBrowserState(stores) {
  return apiRequest('/api/state/import-browser', {
    method: 'POST',
    body: JSON.stringify({ stores }),
  });
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || `API request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}
