const API = 'https://api.github.com';

function encodeContent(obj) {
  const json = JSON.stringify(obj, null, 2);
  return btoa(Array.from(new TextEncoder().encode(json)).map(b => String.fromCharCode(b)).join(''));
}

function decodeContent(b64) {
  const bytes = Uint8Array.from(atob(b64.replace(/\n/g, '')), c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function getConfig() {
  return {
    token: localStorage.getItem('bar-github-token'),
    owner: localStorage.getItem('bar-github-owner'),
    repo: localStorage.getItem('bar-github-repo'),
    branch: localStorage.getItem('bar-github-branch') || 'main',
  };
}

export function setConfig({ token, owner, repo, branch = 'main' }) {
  localStorage.setItem('bar-github-token', token);
  localStorage.setItem('bar-github-owner', owner);
  localStorage.setItem('bar-github-repo', repo);
  localStorage.setItem('bar-github-branch', branch);
}

export function clearConfig() {
  ['bar-github-token', 'bar-github-owner', 'bar-github-repo', 'bar-github-branch', 'bar-github-sha'].forEach(k =>
    localStorage.removeItem(k)
  );
}

export function isConfigured() {
  const { token, owner, repo } = getConfig();
  return !!(token && owner && repo);
}

export async function loadInventory() {
  const { token, owner, repo, branch } = getConfig();
  const res = await fetch(
    `${API}/repos/${owner}/${repo}/contents/inventory.json?ref=${branch}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const data = await res.json();
  localStorage.setItem('bar-github-sha', data.sha);
  return decodeContent(data.content).items || [];
}

export async function saveInventory(items) {
  const { token, owner, repo, branch } = getConfig();
  let sha = localStorage.getItem('bar-github-sha') || undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    const body = { message: 'Update bar inventory', content: encodeContent({ items }), branch };
    if (sha) body.sha = sha;

    const res = await fetch(`${API}/repos/${owner}/${repo}/contents/inventory.json`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('bar-github-sha', data.content.sha);
      return;
    }

    // On SHA conflict, refetch the latest SHA and retry once
    if (res.status === 409 && attempt === 0) {
      const latestRes = await fetch(
        `${API}/repos/${owner}/${repo}/contents/inventory.json?ref=${branch}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
      );
      if (latestRes.ok) {
        const latest = await latestRes.json();
        sha = latest.sha;
        localStorage.setItem('bar-github-sha', sha);
        continue;
      }
    }

    throw new Error(`GitHub ${res.status}`);
  }
}

export async function testConnection({ token, owner, repo }) {
  const res = await fetch(`${API}/repos/${owner}/${repo}/contents/inventory.json`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (res.ok || res.status === 404) return true;
  if (res.status === 401) throw new Error('Invalid token — check that it has not expired');
  if (res.status === 403) throw new Error('Token lacks permission — enable Contents: Read and Write');
  if (res.status === 404 && res.headers.get('x-ratelimit-remaining') === '0') throw new Error('Rate limited — try again in a minute');
  throw new Error(`Cannot reach repo (${res.status}) — check owner and repo name`);
}
