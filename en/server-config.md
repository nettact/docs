# Server configuration (nettact-lite)

`nettact-lite` is the self-hosted, single-binary server: HTTP API + built-in web
console + SQLite storage. It is **configured entirely through command-line
flags** (plus two optional environment variables used for downloading the
frontend, see [The web console frontend](#the-web-console-frontend)). In a Docker
Compose deployment the common options are mapped to flags through `.env` (see
[.env variable mapping](#env-variable-mapping-docker-compose)).

This page matches `nettact-lite --help` item for item; if the two disagree,
`--help` wins — please report the discrepancy.

---

## Flag reference

| Flag | Default | Description |
|---|---|---|
| `-addr` | `:12450` | Listen address (`[host]:port`). **A listen address saved in the console overrides this flag** — see [Listen address](#listen-address). |
| `-db` | `./nettact.db` | Path to the SQLite database (it also creates `-wal`/`-shm` sidecar files). |
| `-webui-dir` | empty (= `<db dir>/webui`) | Download/install directory for the web console frontend; each version installs into `<webui-dir>/<version>/`. |
| `-dev` | `false` | Development mode: opens CORS to the Vite dev origin (web-console), and session cookies never carry `Secure`. Do not use in production. |
| `-admin-user` | empty | Optional; **effective on the first run only**. If omitted, the first run creates an `admin` account with a randomly generated password (printed once). |
| `-admin-pass` | empty | Optional; **effective on the first run only**. If omitted, the first run generates an initial password and prints it (once). |
| `-tls-cert` | empty | Path to the TLS certificate; when supplied together with `-tls-key`, the server serves HTTPS/WSS natively. |
| `-tls-key` | empty | Path to the TLS private key; must be paired with `-tls-cert` — supplying only one makes the server refuse to start (so it can never silently fall back to plaintext). |
| `-secure-cookie` | `auto` | The `Secure` attribute on session cookies: `auto` / `true` / `false`, see [Session cookies](#session-cookies). |

There is also one subcommand:

```
nettact-lite passwd -db <path>     # reset the admin password offline (password recovery)
```

See [Admin credentials and password changes](#admin-credentials-and-password-changes).

---

## .env variable mapping (Docker Compose)

In a Compose deployment you do not write flags directly; you set variables in
`.env` and `docker-compose.yml` maps them (after editing `.env` you need
`docker compose up -d` to recreate the containers before the change takes effect):

| `.env` variable | Default | What it does |
|---|---|---|
| `NETTACT_HTTP_PORT` | `12450` | Port published on the host (inside the container the listener is fixed at `:12450`; this variable only changes the host side of the port mapping). |
| `NETTACT_SECURE_COOKIE` | `auto` | Maps to `-secure-cookie`; set to `true` behind a TLS-terminating reverse proxy. |
| `NETTACT_TZ` | `UTC` | Maps to the container's `TZ`, which decides how the timestamps **people read** are printed (notification bodies, the email footer, log lines). Any IANA zone name, e.g. `Asia/Shanghai`; the image needs no tzdata package. |
| `NETTACT_LITE_VERSION` | `latest` | Server image tag (pinning `vX.Y.Z` is recommended for reproducible upgrades). |
| `NETTACT_AGENT_VERSION` | `latest` | Agent image tag (released independently of the server). |
| `NETTACT_LITE_IMAGE` | `ghcr.io/nettact/nettact-lite` | Override the server image reference (e.g. to test a local build). |
| `NETTACT_AGENT_IMAGE` | `ghcr.io/nettact/nettact-agent` | Override the agent image reference. |

The remaining flags — database path, TLS and so on — are added
or removed directly in the `command:` block of `docker-compose.yml` (the TLS
lines are already there, commented out; remember to switch the healthcheck to
its https variant as well, see
[the deployment guide](./deploy.md#_7-enabling-https-optional)).

---

## Listen address

The listen address has three sources, from highest to lowest precedence:

1. **the listen address saved in the console** (Settings → Listen address, stored in the database);
2. the `-addr` flag;
3. the built-in default `:12450`.

In other words: **once you have saved a listen address in the console, the
`-addr` flag no longer takes effect** (server-info in the console indicates where
the current address came from). If the saved address cannot be bound (port in
use, etc.), the server does not fail to start — it falls back to the
flag/default address automatically and reports this in the logs and in
server-info; a saved value with an invalid format is logged and ignored.

**Leave this setting empty in Docker deployments**: inside the container the
listener is fixed at `:12450` and the port mapping is decided by
`NETTACT_HTTP_PORT`, so saving a listen address in the console would decouple the
container from its port mapping.

---

## Admin credentials and password changes

Single-user (single-admin) model — there are no multiple users or tenants.

- **First run** (empty database): the admin account is created automatically. If
  `-admin-user`/`-admin-pass` are omitted, the username is `admin` and the
  password is randomly generated and **printed once** in the startup logs (the
  `NetTact first run` block); in a Compose deployment, read it with
  `docker compose logs server`.
- `-admin-user` / `-admin-pass` only set the initial account on the first run.
  Later runs ignore both flags — you cannot use them to change the password.
- **Changing the password** (either way):
  - Console: log in and change it on the Settings page;
  - Command line: `nettact-lite passwd -db <path>` (Compose:
    `docker compose exec server nettact-lite passwd -db /data/nettact.db`).
    The new password is entered interactively (never as a command-line argument,
    so it does not land in shell history). After a reset **all existing sessions
    are invalidated immediately**; if the server is running, restarting it once is
    recommended.
- Password policy: at least 8 characters.

---

## Data retention

Metric storage has four tiers: raw samples, 1-minute rollup, 1-hour rollup and
1-day rollup. The retention windows are fixed and not configurable: raw samples
are kept for 2 days, the 1-minute rollup for 30 days, the 1-hour rollup for
2 years, and the 1-day rollup forever.

Charts pick a tier automatically from the query range: ranges of ≤2 hours read
raw data, longer ranges read rollups — so raw samples only serve "last two
hours"-grade detail, while long-term trends come from the rollups. The short raw
window is deliberate: at a 1s probe interval, every extra day of raw data costs
gigabytes of SQLite space.

---

## TLS

When `-tls-cert` and `-tls-key` are both supplied, the server natively serves
HTTPS (the console) and WSS (agent connections), and **the listener becomes
TLS-only** (it no longer accepts plaintext HTTP). Supplying only one of them
fails at startup — this prevents a mistyped certificate mount path from silently
falling back to plaintext and exposing tokens and telemetry.

The alternative is to put a TLS-terminating reverse proxy in front
(Caddy/Nginx/Traefik) and keep the server on plaintext; in that case set
`-secure-cookie` to `true` (see the next section).

---

## Session cookies

Browsers only send a `Secure` cookie on HTTPS pages, so the symptom of getting
this attribute wrong is that **you are logged out immediately after a successful
login** (localhost excepted). `-secure-cookie` takes three values:

| Value | Behaviour | When to use it |
|---|---|---|
| `auto` (default) | `Secure` only when this process has TLS enabled | Almost every case; a plain-HTTP deployment lets you log in out of the box |
| `true` | Always `Secure` | A TLS-terminating reverse proxy in front (https on the browser side, plaintext server) |
| `false` | Never `Secure` | Not recommended |

In `-dev` mode `Secure` is never set (the local Vite dev server is plaintext).

---

## The web console frontend

The frontend (web-console) is **not bundled into the binary or the image**; the
server downloads it at runtime. The exact frontend version is baked in at compile
time, and on the first start the server detects it is missing and downloads it
from the [NetTact Download Center](https://d.nettact.org) (verified by SHA256)
into `-webui-dir` (default `<db dir>/webui`). Until the download completes,
non-`/api` paths return a built-in placeholder page (503) while the API and the
probes keep working; on failure it retries in the background. The default asset
layout is `https://d.nettact.org/web-console/<tag>/<asset>`. The download
center's Cloudflare Worker accesses official GitHub Releases, including private
repositories, so the server needs no GitHub credentials.

Two optional environment variables override this behaviour (for development or
isolated networks):

| Environment variable | What it does |
|---|---|
| `NETTACT_WEBUI_LOCAL` | Serve a local dist directory directly (e.g. `../web-console/dist`). Development builds (`Version=dev`, no baked-in version) do not download automatically — use this. |
| `NETTACT_WEBUI_BASE_URL` | Override the download source; it must expose the `<base>/<tag>/<asset>` layout. You can also go fully offline by pre-installing the frontend into `<webui-dir>/<version>/`. |
