# AbyteDesk ERP — Offline / LAN Test Report

_Last updated: 2026-09-05_

---

## Overview

AbyteDesk is designed for offline-capable LAN deployment. The backend stores all data in a local MariaDB instance with no mandatory cloud dependency. This report documents the offline readiness assessment.

---

## Offline Architecture

| Component | Offline Capable | Notes |
|-----------|----------------|-------|
| Backend API (Node.js) | ✅ Yes | Runs locally on port 5000 |
| Database (MariaDB) | ✅ Yes | All data stored locally |
| Frontend (React) | ✅ Yes | Served as static files or via Vite dev server |
| Printer Agent (Electron) | ✅ Yes | Polls local backend print queue |
| Waiter App (React Native) | ✅ Yes | Connects to LAN backend via configured IP |
| Email notifications | ❌ No | Requires outbound SMTP |
| WhatsApp integration | ❌ No | Requires internet connectivity |
| AI Assistant | ❌ No | Requires Anthropic API access |
| FBR tax sync | ❌ No | Requires FBR API connectivity |

---

## LAN Configuration Assessment

### Backend
- Listens on `0.0.0.0:5000` — reachable on LAN
- CORS configured to allow LAN origins
- JWT tokens issued and verified locally — no external auth provider

### Waiter App
- IP address configurable in app settings to point at the LAN server
- Confirmed: `waiter-app` has LAN config field (noted in v1.0.5 release)

### Frontend
- Vite proxy configured: `/api` → `localhost:5000` in dev mode
- Production build: `VITE_API_URL` env var set to LAN IP (e.g., `http://192.168.1.100:5000`)

### Printer Agent
- Polls `/api/print-queue` on configurable backend URL
- ESC/POS sent directly to local USB/network printer

---

## Offline Failure Modes

### Graceful Degradation
| Feature | Behavior Without Internet |
|---------|--------------------------|
| Core POS (cash sales) | ✅ Fully functional |
| Inventory management | ✅ Fully functional |
| Reports and accounting | ✅ Fully functional |
| Customer/supplier management | ✅ Fully functional |
| HR/Payroll | ✅ Fully functional |
| Email receipts | ❌ Silently fails (caught error, does not block sale) |
| WhatsApp notifications | ❌ Silently fails |
| AI chatbot | ❌ Returns error to user |
| FBR sync | ❌ Returns error; sale is still saved locally |

### Database Connectivity Loss
If MariaDB goes down while the server is running:
- Active requests will receive 500 errors
- No automatic reconnection logic (relies on pool reconnect behavior)
- **Recommendation:** Enable MariaDB auto-restart and configure connection pool retry

---

## Data Persistence Verification

| Data Type | Stored In | Persists Offline |
|-----------|-----------|-----------------|
| Sales records | `sales` + `sale_details` | ✅ |
| Inventory levels | `inventory` + `products` | ✅ |
| Customer data | `customers` | ✅ |
| Financial records | `journal_entries`, vouchers | ✅ |
| Audit logs | `audit_logs` | ✅ |
| Print jobs | `print_queue` | ✅ |
| User sessions (JWT) | Token blacklist (in-memory) | ⚠️ Blacklist lost on server restart |

**Note:** The token blacklist is in-memory. A server restart during an active session clears the blacklist, meaning logged-out tokens could theoretically be replayed until expiry. For a LAN deployment this is low risk; for hardened deployments, persist the blacklist to MariaDB.

---

## Backup & Recovery

- `GET /api/backup` endpoint triggers database dump
- Backups stored locally in the `backups/` directory
- No automated backup schedule confirmed in the codebase (manual trigger only)
- **Recommendation:** Add a cron-based automated backup or OS-level scheduled task

---

## Verdict

**AbyteDesk is fully functional for offline LAN deployment** for all core ERP operations (POS, inventory, purchasing, accounting, HR). Internet-dependent features (email, WhatsApp, AI, FBR) fail gracefully without blocking core operations. Token blacklist volatility is a low-risk issue for the target deployment context.
