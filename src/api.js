// Talks to deploy/server.mjs. Writes go out one at a time so rapid +/- taps
// land on the server in the order they were made.

let queue = Promise.resolve();

function enqueue(fn) {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
}

async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: {
      Accept: 'application/json',
      // Tells Authelia to answer an expired session with 401 instead of a login redirect.
      'X-Requested-With': 'XMLHttpRequest',
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  // Session expired: reload so Authelia can show its login page, then the app reloads its data.
  if (res.status === 401 || res.redirected || (res.ok && res.status !== 204 && !res.headers.get('content-type')?.includes('json'))) {
    window.location.reload();
    throw new Error('Signed out');
  }
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({}));
    throw new Error(error || `Server ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export function loadInventory() {
  return request('GET', '/api/items');
}

export function saveItem(item) {
  return enqueue(() => request('PUT', `/api/items/${encodeURIComponent(item.id)}`, item));
}

export function deleteItem(id) {
  return enqueue(() => request('DELETE', `/api/items/${encodeURIComponent(id)}`));
}
