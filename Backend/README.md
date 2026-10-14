# IP Tracker Backend

Express API backed by PostgreSQL. See the [root README](../README.md) for the full project overview and Docker setup.

## Run locally

```bash
cp .env.example .env     # set DB_* (or DATABASE_URL) and JWT_SECRET
npm install
npm run dev              # nodemon; use `npm start` for production
```

The database must already contain the schema in `sql/complete_schema.sql`, which also creates the default roles and the `admin` user:

```bash
createdb ip_tracker
psql -d ip_tracker -f sql/complete_schema.sql
```

On startup the server runs a small initialization step (`config/init.js`) that creates an `admin` user only if no active admin exists.

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `3000` | |
| `DATABASE_URL` | unset | Full connection string; takes precedence over `DB_*` (SSL is enabled when `NODE_ENV=production`) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | `localhost`, `5432`, `ip_tracker`, `postgres`, empty | |
| `DB_SSL` | `false` | Set to `true` for hosted databases that require SSL |
| `JWT_SECRET` | insecure placeholder | Always override |
| `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN` | `1h`, `7d` | |
| `BACKEND_URL` | `http://localhost:<PORT>` | Only used in the startup log |

## Endpoints

- `GET /health`
- `/api/auth`: `register`, `login`, `refresh`, `logout`, `profile`, `change-password`
- `/api/users`: CRUD, `POST /:user_id/reset-password`, `GET /:user_id/devices`
- `/api/devices`: CRUD, plus the public `POST /ping`
- `/api/assignments`: CRUD, `POST /bulk`, `GET /stats/overview`

### Device ping

```
POST /api/devices/ping
Content-Type: application/json

{
  "device_name": "raspberrypi-01",
  "local_ip": "192.168.1.100",
  "public_ip": "203.0.113.1",
  "wifi_network": "office",
  "port": 22
}
```

`device_name` is required; every other field is optional. The device is created on first ping and its IP history is updated when the address changes.

## Tests

```bash
cd newman-tests
npx newman run IP-Tracker-Complete-Tests.postman_collection.json \
  -e IP-Tracker-Environment.postman_environment.json
```

Requires the API running on `http://localhost:3000` with the default `admin` / `admin` user.

## Raspberry Pi client

`scripts/install.sh` (and `piip-logger/install.sh`) install a systemd service that pings the backend periodically.
