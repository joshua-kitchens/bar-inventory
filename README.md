# Bar inventory

React (Vite) front end plus a dependency-free Node server ([deploy/server.mjs](deploy/server.mjs))
that serves the build and a small JSON API backed by SQLite (Node's built-in `node:sqlite`, Node 22.13+).

## Local development

```sh
npm install
npm run serve   # API + built app on http://127.0.0.1:3006, database in deploy/inventory.db
npm run dev     # Vite dev server in a second terminal; proxies /api to :3006
```

On first start with an empty database, the server imports `inventory.json` (the old
GitHub-stored list) once. After that the file is ignored.

## Deploying (DigitalOcean droplet)

```
browser ──HTTPS──▶ Caddy + Authelia ──▶ 127.0.0.1:3006 Node (inventory.service)
                                            serves /srv/sites/inventory/dist + /api
                                            database: /var/lib/inventory/inventory.db
```

Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml):
it builds and rsyncs `server.mjs` + `dist/` to `/srv/sites/inventory/`. The database is
outside that folder, so deploys never touch it. The service restarts only when
[deploy/server.mjs](deploy/server.mjs) changes.

### One-time server setup

Steps 1–2 can be skipped if the `deploy` user and key already exist from the recipes site;
reuse the same key and secrets.

1. **Deploy user and folder**:
   ```sh
   sudo adduser --disabled-password --gecos "" deploy   # if not already there
   sudo mkdir -p /srv/sites/inventory
   sudo chown deploy:deploy /srv/sites/inventory
   node --version   # must be 22.13 or newer for node:sqlite
   ```
2. **Deploy key** (on your PC): `ssh-keygen -t ed25519 -f jkitchens-deploy -N "" -C "github-actions"`,
   then append `jkitchens-deploy.pub` to `/home/deploy/.ssh/authorized_keys` (mode 600, owned by `deploy`).
3. **Let deploy restart the service** (only that one command):
   ```sh
   echo 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart inventory' | sudo tee /etc/sudoers.d/deploy-inventory
   sudo chmod 440 /etc/sudoers.d/deploy-inventory
   ```
4. **GitHub secrets** (repo Settings → Secrets and variables → Actions):
   `DEPLOY_HOST` (droplet IP), `DEPLOY_USER` (`deploy`), `DEPLOY_SSH_KEY` (private key file contents),
   `DEPLOY_KNOWN_HOSTS` (output of `ssh-keyscan <droplet ip>`).
5. **Turn off GitHub Pages**: repo Settings → Pages → Source: none, so the old copy stops being served.
6. **First deploy**: Actions → Deploy → Run workflow. (The restart step warns until step 7 is done; that's expected.)
7. **Node service**: copy [deploy/inventory.service](deploy/inventory.service) to `/etc/systemd/system/`, then
   `sudo systemctl daemon-reload && sudo systemctl enable --now inventory`.
   Check with `curl http://127.0.0.1:3006/api/items` and `journalctl -u inventory` (should say "Imported N items").
8. **Caddy + Authelia**: the site's block in `/etc/caddy/Caddyfile` should proxy to `127.0.0.1:3006`
   behind `forward_auth` to Authelia, as in [deploy/Caddyfile](deploy/Caddyfile). Make sure Authelia's
   `access_control` rules cover the domain with `one_factor` or `two_factor` (not `bypass`), since the
   server has no login of its own. Then `sudo systemctl reload caddy`.

Until `DEPLOY_HOST` is set, the workflow still builds the app but skips the upload.

### Backups

The whole inventory is one SQLite file. A consistent copy while the service is running:

```sh
sudo sqlite3 /var/lib/inventory/inventory.db ".backup /root/inventory-$(date +%F).db"
```
