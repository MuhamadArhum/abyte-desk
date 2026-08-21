# AByte ERP — Offline LAN Conversion Roadmap

Single server PC + multiple client PCs via LAN. No internet required.

---

## Phase 1 — Remove Multi-Branch System ✅ DONE

- [x] Remove `branch_id` from JWT and auth middleware
- [x] Remove branch filtering from all 19 backend controllers
- [x] Remove `storeRoutes` and `stockTransferRoutes` from server.js
- [x] Remove `assignBranch` from userController and userRoutes
- [x] Remove `branchFilter` interceptor from frontend api.ts
- [x] Remove `activeBranchId` / `setActiveBranchId` from AuthContext
- [x] Remove branch selector dropdown from Layout.tsx
- [x] Remove Stores and StockTransfers pages from App.tsx
- [x] Remove branch column/field from Users page
- [x] Remove "Sales by Branch" section from SalesReports page
- [x] Fix test files that referenced branchFilter

---

## Phase 2 — Server Electron App ✅ DONE

Runs on the **server PC**. Manages the Node.js backend process.

- [x] Create `server-app/` directory with Electron setup
- [x] `main.js` — spawn/stop backend as child process
- [x] System tray icon with Start / Stop / Settings / Quit menu
- [x] Dashboard UI — server status, LAN IP display, live log viewer
- [x] First-run setup wizard — DB credentials + JWT secret generation
- [x] Auto-start on Windows boot toggle
- [x] Single instance lock — prevent duplicate server processes
- [x] `preload.js` — secure IPC bridge between main and renderer

---

## Phase 3 — Client Electron App ✅ DONE

Runs on **each client PC**. Shows the ERP frontend in an Electron window.

- [x] Create `client-app/` directory with Electron setup
- [x] First-launch wizard — ask for server IP address
- [x] Save server IP to local `config.json`
- [x] Load `http://<server-ip>:5000` in BrowserWindow
- [x] Connection status indicator — show error if server unreachable
- [x] Retry / reconnect button when connection is lost
- [x] Settings screen — change server IP address
- [x] `package.json` with electron-builder config for Windows installer

---

## Phase 4 — Multi-Tenant to Single-Tenant Simplification ✅ DONE

Remove the `abyte_master` dependency. One DB, one company.

- [x] Remove `company_code` field from login screen
- [x] Remove master DB lookup from `authController.login`
- [x] Remove `queryDb(MASTER_DB, ...)` calls from auth flow
- [x] Remove `tenant_id`, `tenant_db`, `modules` from JWT payload
- [x] Remove `requireModule()` middleware from all routes (no-op)
- [x] Remove `tenantRoutes` super-admin CRUD, keep config endpoints
- [x] Replace `queryDb(tenantDb, ...)` with direct `query()` everywhere
- [x] Remove `AsyncLocalStorage` tenant routing from `database.js`
- [x] Update `server.js` startup — connect to single DB directly
- [x] Make `requireModule` a no-op in `moduleGuard.js`
- [x] Remove module/plan gating from frontend (`hasModule` always returns true)
- [x] Drop `MASTER_DB_NAME` requirement from `.env` / `validateEnv.js`

---

## Phase 5 — Database & Schema Cleanup ✅ DONE

- [x] Remove `stores` table from `database/schema.sql`
- [x] Remove `store_inventory` table from schema
- [x] Remove `branch_id` column from all tables in schema
- [x] Remove `stockTransfer` related tables from schema
- [x] Write a migration script to drop branch columns from existing DBs (migration v22)
- [x] Remove tenant-related tables from `database/master_schema.sql`
- [x] Test fresh DB creation with updated schema

---

## Phase 6 — Packaging & Installer ✅ DONE

- [x] Configure `electron-builder` for Server App — NSIS installer
- [x] Configure `electron-builder` for Client App — NSIS installer
- [x] Bundle backend code into Server App via `extraResources`
- [x] Include MariaDB setup guide (`SETUP_GUIDE.txt`) in Server installer
- [x] Server installer: `init-db` IPC handler creates DB + applies schema.sql on first run
- [x] Client installer: lightweight, no DB or backend needed
- [ ] Test install on a clean Windows 11 machine (manual)
- [ ] Test LAN connection between server PC and 2+ client PCs (manual)

---

## Architecture Reference

```
SERVER PC
├── MariaDB (Windows Service)
├── server-app (Electron)
│   ├── Spawns: main-app/backend/server.js
│   └── System tray + Dashboard
└── Listens on: 0.0.0.0:5000

CLIENT PCs (each)
└── client-app (Electron)
    └── BrowserWindow → http://<server-ip>:5000
```
