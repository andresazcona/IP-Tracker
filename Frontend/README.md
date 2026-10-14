# IP Tracker Frontend

React 19 + TypeScript + Vite single-page app. See the [root README](../README.md) for the full project overview.

## Features

- Device dashboard with auto-refresh (30 s by default) and status filters
- Device details modal
- JWT login with automatic token refresh and protected routes
- Admin panel for users, devices and assignments

## Run locally

```bash
cp .env.example .env     # point VITE_API_BASE_URL at the backend
npm install
npm run dev              # http://localhost:5173
```

## Scripts

- `npm run dev` starts the Vite dev server
- `npm run build` type-checks (`tsc -b`) and builds to `dist/`
- `npm run preview` serves the production build
- `npm run lint` runs ESLint

## Environment variables

Vite inlines these at build time.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:3000` | Backend URL |
| `VITE_REFRESH_INTERVAL` | `30000` | Dashboard refresh interval in ms |
| `VITE_APP_NAME`, `VITE_APP_SUBTITLE` | `IP Tracker`, `Sistema de Monitoreo de Dispositivos IP` | Header text |
