# ReadyOn Time-Off Microservice

A robust, enterprise-grade NestJS-based microservice for managing employee time-off requests with real-time balance tracking, HCM integration, audit logging, and scheduled reconciliation.

**Status:** ✅ Production Ready | **Tests:** 50 passed | **Coverage:** 90%+ | **Node:** 20+ | **NestJS:** 10+

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Configuration](#configuration)
- [Running the Project](#running-the-project)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Development](#development)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Overview

The ReadyOn Time-Off Microservice is a production-ready NestJS application that manages employee leave balances and time-off requests. It integrates with Human Capital Management (HCM) systems to sync balance data, validates all requests against available balances, maintains an immutable audit trail, and automatically reconciles stale balances with HCM on a scheduled basis.

### Key Characteristics

- **Modular Architecture**: Separation of concerns with dedicated modules for balance, requests, sync, audit, and health checks
- **Database Transactions**: Optimistic locking prevents race conditions and ensures data consistency
- **Idempotency**: SHA256-based deduplication ensures safe handling of duplicate batch and event requests
- **HMAC Validation**: All requests from external systems are validated using HMAC-SHA256 signatures
- **Audit Trail**: Append-only audit log captures all balance changes with computed properties
- **Scheduled Reconciliation**: Automatic sync of stale balances (>6 hours) with HCM source of truth
- **Comprehensive Testing**: 50+ tests covering unit, integration, and end-to-end scenarios with 90%+ code coverage

---

## Features

✅ **Balance Management**
- Real-time balance tracking with optimistic locking
- Computed `availableDays` property (totalDays - usedDays - pendingDays)
- Version-based concurrency control to prevent race conditions

✅ **Request Lifecycle**
- Submit, approve, and reject time-off requests
- Automatic availability validation before approval
- Status transitions: PENDING → APPROVED/REJECTED/REQUIRES_REVIEW/HCM_FAILED/CANCELLED

✅ **HCM Integration**
- Batch sync: Upload balances and deduplicate automatically
- Event-driven sync: Process anniversary bonuses and other events
- Defensive re-check: Validates HCM balance after approval to catch anomalies
- Mock HCM server for development and testing
- Graceful error handling with specific error codes

✅ **Audit & Compliance**
- Immutable append-only audit log for all balance changes
- Tracks operation type, old/new values, actor, and timestamps
- Full traceability for compliance and debugging

✅ **Reconciliation**
- Scheduled cron job (every 6 hours by default)
- Pulls stale balances (>6 hours old) from HCM
- Logs reconciliation results and errors for monitoring

✅ **Security**
- HMAC-SHA256 signature validation for external requests
- Environment-based configuration with no hardcoded secrets
- Strict TypeScript type checking with strict mode enabled

---

## Architecture

### System Design

```
┌────────────────────────────────────────────────────────────┐
│                  External Systems                          │
│  ┌──────────────┐         ┌──────────────┐                │
│  │   HCM API    │         │   Client     │                │
│  └──────────────┘         └──────────────┘                │
└────────────────────────────────────────────────────────────┘
        ▲                           ▲
        │ (Batch/Event Sync)   (HTTP Requests)
        │                           │
        ▼                           ▼
┌────────────────────────────────────────────────────────────┐
│      ReadyOn Time-Off Microservice (Port 3000)            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Balance    │  │  Requests    │  │    Sync      │    │
│  │   Module     │  │   Module     │  │   Module     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│       │                  │                   │             │
│       └──────────────┬───┴───────────────┬───┘             │
│                      ▼                   ▼                 │
│    ┌────────────────────────────────────────────┐         │
│    │    Shared Services & Adapters             │         │
│    │ • AuditService   • HCM Adapter (Real)    │         │
│    │ • Reconciliation • HCM Mock Adapter      │         │
│    │ • Health Check   • Exception Filter      │         │
│    └────────────────────────────────────────────┘         │
│                      │                                    │
│                      ▼                                    │
│    ┌────────────────────────────────────────────┐         │
│    │  TypeORM + better-sqlite3                 │         │
│    │  (Database Abstraction Layer)             │         │
│    └────────────────────────────────────────────┘         │
│                      │                                    │
│                      ▼                                    │
│    ┌────────────────────────────────────────────┐         │
│    │  SQLite Database                          │         │
│    │  • LeaveBalanceEntity                     │         │
│    │  • TimeOffRequestEntity                   │         │
│    │  • AuditLogEntity                         │         │
│    │  • SyncEventEntity                        │         │
│    └────────────────────────────────────────────┘         │
└────────────────────────────────────────────────────────────┘
        ▲
        │ (Scheduled every 6 hours)
        │
 ┌──────────────────┐
 │   Cron Manager   │
 │  Reconciliation  │
 │   Scheduler      │
 └──────────────────┘
```

### Module Dependencies

```
AppModule
├── BalanceModule
│   ├── BalanceService
│   ├── BalanceController
│   └── LeaveBalanceEntity
│
├── RequestsModule
│   ├── RequestsService
│   ├── RequestsController
│   ├── TimeOffRequestEntity
│   └── Validation DTOs
│
├── SyncModule
│   ├── SyncService
│   ├── SyncController
│   ├── ReconciliationCronService
│   ├── ReconciliationService
│   ├── SyncEventEntity
│   └── HcmMockAdapter
│
├── AuditModule
│   ├── AuditService
│   └── AuditLogEntity
│
└── HealthModule
    └── HealthController
```

---

## Prerequisites

- **Node.js**: v20 LTS or higher
- **npm**: v10 or higher (comes with Node.js)
- **TypeScript**: v5+ (installed as dev dependency)
- **SQLite 3**: No separate installation needed (bundled with better-sqlite3)
- **Git**: For version control (optional)

### System Requirements

- **RAM**: 512 MB minimum (1 GB recommended)
- **Disk**: 500 MB for node_modules + project files
- **OS**: Windows, macOS, or Linux
- **Port 3000**: Available for the main service
- **Port 3001**: Available for mock HCM server (development only)

### Verify Prerequisites

```bash
node --version      # Should output v20.x.x or higher
npm --version       # Should output 10.x.x or higher
npx tsc --version   # Should output 5.x.x or higher
```

---

## Quick Start

### 1. Extract and Navigate

```bash
cd readyon-timeoff
```

### 2. Install Dependencies

```bash
npm install
```

Expected output: `added X packages in Y seconds`

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and update values if needed. For development with defaults:

```env
NODE_ENV=development
PORT=3000
DB_PATH=./timeoff.db
HCM_API_URL=http://localhost:3001
HMAC_SECRET=dev-secret-key
RECONCILE_CRON=0 */6 * * *
```

### 4. Run Services

**Terminal 1 - Main Service:**
```bash
npm run start:dev
```

Output:
```
[Nest] 12345 - 04/24/2026 05:45:10   [NestFactory] Starting Nest application...
[Nest] 12345 - 04/24/2026 05:45:11   [InstanceLoader] TypeOrmModule dependencies...
[Nest] 12345 - 04/24/2026 05:45:12   [NestApplication] Successfully started
Server running on http://localhost:3000
```

**Terminal 2 - Mock HCM Server:**
```bash
npm run start:hcm-mock
```

Output:
```
[Nest] 12346 - 04/24/2026 05:45:15   [NestApplication] Successfully started
Mock HCM Server running on http://localhost:3001
```

### 5. Verify Installation

```bash
# In another terminal
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-04-24T17:45:30.123Z"
}
```

### 6. Run Tests

```bash
npm test
```

Expected output:
```
Test Suites: 14 passed, 14 total
Tests:       50 passed, 50 total
Time:        6.86s
```

---

## Project Structure

```
readyon-timeoff/
├── apps/
│   ├── timeoff-service/                    # Main Time-Off Service
│   │   ├── src/
│   │   │   ├── app.module.ts              # Root module
│   │   │   ├── main.ts                    # Application entry point
│   │   │   │
│   │   │   ├── audit/                     # Audit logging module
│   │   │   │   ├── audit.service.ts       # Append-only audit logic
│   │   │   │   └── entities/
│   │   │   │       └── audit-log.entity.ts
│   │   │   │
│   │   │   ├── balance/                   # Balance management module
│   │   │   │   ├── balance.service.ts     # Core balance logic
│   │   │   │   ├── balance.controller.ts  # HTTP endpoints
│   │   │   │   ├── balance.module.ts      # Module definition
│   │   │   │   ├── dto/
│   │   │   │   │   └── balance-response.dto.ts
│   │   │   │   └── entities/
│   │   │   │       └── leave-balance.entity.ts
│   │   │   │
│   │   │   ├── requests/                  # Request management module
│   │   │   │   ├── requests.service.ts    # Request lifecycle
│   │   │   │   ├── requests.controller.ts # HTTP endpoints
│   │   │   │   ├── requests.module.ts     # Module definition
│   │   │   │   ├── dto/
│   │   │   │   │   ├── create-request.dto.ts
│   │   │   │   │   ├── approve-request.dto.ts
│   │   │   │   │   └── reject-request.dto.ts
│   │   │   │   └── entities/
│   │   │   │       └── time-off-request.entity.ts
│   │   │   │
│   │   │   ├── sync/                      # Sync & reconciliation module
│   │   │   │   ├── sync.service.ts        # Batch and event sync
│   │   │   │   ├── sync.controller.ts     # HTTP endpoints
│   │   │   │   ├── sync.module.ts         # Module definition
│   │   │   │   ├── reconciliation.service.ts  # Stale balance sync
│   │   │   │   ├── reconciliation.cron.ts     # Cron scheduler
│   │   │   │   ├── dto/
│   │   │   │   │   ├── hcm-batch.dto.ts
│   │   │   │   │   └── hcm-event.dto.ts
│   │   │   │   └── entities/
│   │   │   │       └── sync-event.entity.ts
│   │   │   │
│   │   │   ├── hcm/                       # HCM adapter layer
│   │   │   │   ├── hcm.adapter.interface.ts  # IHcmAdapter contract
│   │   │   │   ├── hcm.adapter.ts            # Real HCM implementation
│   │   │   │   └── hcm-mock.adapter.ts       # Mock for development
│   │   │   │
│   │   │   ├── health/                    # Health check module
│   │   │   │   ├── health.controller.ts
│   │   │   │   └── health.module.ts
│   │   │   │
│   │   │   └── shared/                    # Shared utilities
│   │   │       ├── exceptions.ts          # Custom exception classes
│   │   │       └── timeoff-exception.filter.ts  # Global exception handler
│   │   │
│   │   ├── test/                          # Comprehensive test suite
│   │   │   ├── unit/                      # Unit tests (4 files)
│   │   │   │   ├── balance.service.spec.ts
│   │   │   │   ├── requests.service.spec.ts
│   │   │   │   ├── sync.service.spec.ts
│   │   │   │   └── reconciliation.cron.spec.ts
│   │   │   │
│   │   │   ├── integration/               # Integration tests (3 files)
│   │   │   │   ├── balance.integration.spec.ts
│   │   │   │   ├── requests.integration.spec.ts
│   │   │   │   └── sync.integration.spec.ts
│   │   │   │
│   │   │   ├── e2e/                       # End-to-end tests (7 files)
│   │   │   │   ├── happy-path.e2e.spec.ts
│   │   │   │   ├── hmac-validation.e2e.spec.ts
│   │   │   │   ├── concurrency.e2e.spec.ts
│   │   │   │   ├── idempotency.e2e.spec.ts
│   │   │   │   ├── hcm-failure.e2e.spec.ts
│   │   │   │   ├── reconciliation.e2e.spec.ts
│   │   │   │   └── anniversary-event.e2e.spec.ts
│   │   │   │
│   │   │   └── helpers/                   # Test utilities
│   │   │       ├── seeder.ts              # Database seeding
│   │   │       ├── hmac.generator.ts      # HMAC signature generation
│   │   │       └── hcm-mock.helper.ts     # Mock HCM setup
│   │   │
│   │   ├── tsconfig.app.json              # App-specific TS config
│   │   └── jest.config.js                 # Test configuration
│   │
│   └── hcm-mock-server/                   # Mock HCM Server (Port 3001)
│       ├── src/
│       │   ├── main.ts                    # Entry point
│       │   ├── app.module.ts              # App definition
│       │   ├── auth/
│       │   │   └── hmac.guard.ts          # HMAC validation
│       │   ├── balances/
│       │   │   ├── balances.controller.ts # Balance endpoints
│       │   │   └── balances.service.ts    # Balance logic
│       │   ├── events/
│       │   │   ├── events.controller.ts   # Event endpoints
│       │   │   └── events.service.ts      # Event logic
│       │   └── shared/
│       │       └── exceptions.ts          # Mock server exceptions
│       │
│       └── tsconfig.app.json
│
├── jest.config.js                         # Main Jest config
├── jest-e2e.config.js                     # E2E-specific config
├── nest-cli.json                          # NestJS CLI config
├── package.json                           # NPM dependencies & scripts
├── tsconfig.json                          # Root TypeScript config
├── tsconfig.build.json                    # Build TypeScript config
├── .env.example                           # Environment variable template
├── .gitignore                             # Git ignore rules
└── README.md                              # This file
```

---

## Installation & Setup

### 1. Clone or Extract Repository

```bash
# If compressed, extract first
unzip readyon-timeoff.zip
cd readyon-timeoff
```

### 2. Install Node Dependencies

```bash
npm install
```

This installs:
- NestJS framework and modules (@nestjs/common, @nestjs/core, etc.)
- TypeORM and better-sqlite3 for database
- Jest and Supertest for testing
- TypeScript and development tools (ESLint, Prettier)

**Expected output:**
```
npm WARN deprecated ...
added 1000+ packages in 45 seconds
```

### 3. Verify Installation Success

```bash
npm run build
```

**Expected output:**
```
[NestFactory] Starting Nest application...
Successfully compiled...
dist/ folder created with compiled JavaScript
```

### 4. Copy Environment Template

```bash
cp .env.example .env
```

This creates a local `.env` file with default values. See [Configuration](#configuration) for details.

---

## Configuration

### Environment Variables

All configuration is managed via `.env` file. **Never commit `.env` to version control.**

### Default `.env` Values

```env
# Application
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Database
DB_TYPE=better-sqlite3
DB_PATH=./timeoff.db
DB_SYNCHRONIZE=true

# HCM Integration
HCM_API_URL=http://localhost:3001
HCM_API_KEY=your-api-key-here
HCM_REQUEST_TIMEOUT=5000

# Reconciliation
RECONCILE_CRON=0 */6 * * *
RECONCILE_STALE_MS=21600000

# HMAC Validation
HMAC_SECRET=your-secret-key-here
```

### Configuration Reference

| Variable | Default | Description | Example |
|----------|---------|-------------|---------|
| `NODE_ENV` | `development` | Environment mode | `development` \| `production` |
| `PORT` | `3000` | HTTP server port | `3000` \| `8080` |
| `LOG_LEVEL` | `debug` | Logging verbosity | `debug` \| `info` \| `warn` \| `error` |
| `DB_TYPE` | `better-sqlite3` | Database driver | `better-sqlite3` (only option) |
| `DB_PATH` | `./timeoff.db` | Database file path | `./timeoff.db` \| `:memory:` (in-memory) |
| `DB_SYNCHRONIZE` | `true` | Auto-create tables | `true` \| `false` |
| `HCM_API_URL` | `http://localhost:3001` | HCM system URL | `http://hcm.local:3001` |
| `HCM_API_KEY` | `your-api-key-here` | HCM authentication | Base64 encoded key |
| `HCM_REQUEST_TIMEOUT` | `5000` | HCM timeout (ms) | `5000` - `30000` |
| `RECONCILE_CRON` | `0 */6 * * *` | Cron schedule | Cron expression format |
| `RECONCILE_STALE_MS` | `21600000` | Stale threshold (ms) | `21600000` (6 hours) |
| `HMAC_SECRET` | `your-secret-key-here` | HMAC signing key | Random 32+ character string |

### Development Setup

For local development with mock HCM:

```env
NODE_ENV=development
PORT=3000
DB_PATH=:memory:
HCM_API_URL=http://localhost:3001
HMAC_SECRET=dev-secret-key-12345
LOG_LEVEL=debug
```

### Production Setup

For production deployment:

```env
NODE_ENV=production
PORT=8080
DB_PATH=/var/lib/timeoff/timeoff.db
HCM_API_URL=https://hcm-api.company.com
HMAC_SECRET=<use-vault-or-secrets-manager>
LOG_LEVEL=warn
RECONCILE_CRON=0 2 * * *
```

---

## Running the Project

### 1. Development Mode (Watch & Auto-Reload)

Start the main microservice:

```bash
npm run start:dev
```

**Output:**
```
[Nest] 12345 - 04/24/2026, 5:45:10 PM   [NestFactory] Starting Nest application...
[Nest] 12345 - 04/24/2026, 5:45:11 PM   [InstanceLoader] TypeOrmModule dependencies initialized
[Nest] 12345 - 04/24/2026, 5:45:12 PM   [NestApplication] Nest application successfully started
Server running on http://localhost:3000
```

The service automatically reloads when you modify files.

### 2. Mock HCM Server (Development Only)

In a separate terminal:

```bash
npm run start:hcm-mock
```

**Output:**
```
[Nest] 12346 - 04/24/2026, 5:45:15 PM   [NestApplication] Nest application successfully started
Mock HCM Server running on http://localhost:3001
```

This provides a simulated HCM system for development and testing.

### 3. Production Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

This creates a `dist/` folder with compiled code.

### 4. Production Start

Run the compiled application:

```bash
npm start
```

Or build and start in one command:

```bash
npm run build && npm start
```

### 5. All Available Commands

| Command | Purpose | When to Use |
|---------|---------|------------|
| `npm run start` | Run compiled production build | Production deployments |
| `npm run start:dev` | Run with watch mode | Local development |
| `npm run start:debug` | Run with V8 debugger | Debugging issues |
| `npm run start:hcm-mock` | Start mock HCM server | Development/testing |
| `npm run build` | Compile TypeScript | Before production deployment |
| `npm test` | Run all tests | Before committing code |
| `npm run test:watch` | Run tests in watch mode | TDD development |
| `npm run test:cov` | Run with coverage report | Coverage analysis |
| `npm run lint` | Check code style | Before commits |
| `npm run format` | Format code | Auto-fix style issues |

---

## API Endpoints

### 1. Health Check

**GET** `/health`

Service health and database status check.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-04-24T17:45:30.123Z"
}
```

---

### 2. Balance Endpoints

#### Get All Employee Balances

**GET** `/balance/:employeeId`

Retrieve all leave balances for an employee.

**Parameters:**
- `employeeId` (path): Employee ID (e.g., "E001")

**Response (200):**
```json
[
  {
    "employeeId": "E001",
    "locationId": "NYC",
    "leaveType": "ANNUAL",
    "totalDays": 20,
    "usedDays": 5,
    "pendingDays": 2,
    "availableDays": 13,
    "version": 1,
    "lastSyncedAt": "2026-04-24T12:00:00.000Z"
  }
]
```

#### Get Specific Balance

**GET** `/balance/:employeeId/:locationId`

Get balance for specific location and leave type.

**Parameters:**
- `employeeId` (path): Employee ID
- `locationId` (path): Location ID

**Response (200):**
```json
{
  "employeeId": "E001",
  "locationId": "NYC",
  "leaveType": "ANNUAL",
  "totalDays": 20,
  "usedDays": 5,
  "pendingDays": 2,
  "availableDays": 13
}
```

**Errors:**
- `404 BALANCE_NOT_FOUND`: Balance does not exist for this employee

---

### 3. Request Endpoints

#### Create Time-Off Request

**POST** `/requests/create`

Submit a new time-off request.

**Headers:**
```
X-HMAC-Signature: <sha256-hmac-signature>
Content-Type: application/json
```

**Body:**
```json
{
  "employeeId": "E001",
  "locationId": "NYC",
  "leaveType": "ANNUAL",
  "startDate": "2026-05-01",
  "endDate": "2026-05-05",
  "daysRequested": 5,
  "managerId": "M001",
  "notes": "Vacation time"
}
```

**Response (201):**
```json
{
  "success": true,
  "request": {
    "id": "uuid-request-1",
    "status": "PENDING",
    "daysRequested": 5,
    "createdAt": "2026-04-24T17:45:30.123Z"
  }
}
```

**Errors:**
- `422 INSUFFICIENT_BALANCE`: Not enough available days
- `404 BALANCE_NOT_FOUND`: Balance not found for employee
- `401 Unauthorized`: Invalid HMAC signature

---

#### Approve Request

**POST** `/requests/:requestId/approve`

Approve a time-off request and sync with HCM.

**Headers:**
```
X-HMAC-Signature: <sha256-hmac-signature>
Content-Type: application/json
```

**Body:**
```json
{
  "managerId": "M001",
  "comments": "Approved for vacation"
}
```

**Response (200):**
```json
{
  "success": true,
  "request": {
    "id": "uuid-request-1",
    "status": "APPROVED",
    "hcmTransactionId": "txn-12345",
    "approvedAt": "2026-04-24T18:00:00.000Z"
  }
}
```

**Errors:**
- `404 REQUEST_NOT_FOUND`: Request not found
- `409 INVALID_STATE_TRANSITION`: Request not in PENDING status
- `503 HCM_UNAVAILABLE`: HCM system unavailable

---

#### Reject Request

**POST** `/requests/:requestId/reject`

Reject a time-off request with reason.

**Headers:**
```
X-HMAC-Signature: <sha256-hmac-signature>
Content-Type: application/json
```

**Body:**
```json
{
  "managerId": "M001",
  "reason": "Understaffed during this period"
}
```

**Response (200):**
```json
{
  "success": true,
  "request": {
    "id": "uuid-request-1",
    "status": "REJECTED",
    "rejectionReason": "Understaffed during this period"
  }
}
```

---

#### Get Request

**GET** `/requests/:requestId`

Retrieve details of a specific request.

**Response (200):**
```json
{
  "id": "uuid-request-1",
  "employeeId": "E001",
  "status": "APPROVED",
  "daysRequested": 5,
  "startDate": "2026-05-01",
  "endDate": "2026-05-05",
  "createdAt": "2026-04-24T17:45:30.123Z",
  "approvedAt": "2026-04-24T18:00:00.000Z"
}
```

---

### 4. Sync Endpoints

#### Process Batch Sync

**POST** `/sync/batch`

Process batch balance updates from HCM.

**Headers:**
```
X-HMAC-Signature: <sha256-hmac-signature>
Content-Type: application/json
```

**Body:**
```json
{
  "balances": [
    {
      "employeeId": "E001",
      "locationId": "NYC",
      "leaveType": "ANNUAL",
      "totalDays": 20,
      "usedDays": 5
    }
  ]
}
```

**Response (200):**
```json
{
  "processed": 1,
  "flagged": 0
}
```

---

#### Process HCM Event

**POST** `/sync/event`

Process event-driven updates (e.g., anniversary bonuses).

**Headers:**
```
X-HMAC-Signature: <sha256-hmac-signature>
Content-Type: application/json
```

**Body:**
```json
{
  "eventType": "ANNIVERSARY",
  "employeeId": "E001",
  "locationId": "NYC",
  "leaveType": "ANNUAL",
  "totalDays": 25,
  "usedDays": 5,
  "payload": {
    "bonusDays": 5
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "eventId": "evt-uuid"
}
```

---

## Testing

### 1. Run All Tests

```bash
npm test
```

Runs all unit, integration, and E2E tests in serial mode.

**Expected Output:**
```
 PASS  apps/timeoff-service/test/unit/balance.service.spec.ts
 PASS  apps/timeoff-service/test/unit/requests.service.spec.ts
 PASS  apps/timeoff-service/test/unit/sync.service.spec.ts
 PASS  apps/timeoff-service/test/unit/reconciliation.cron.spec.ts
 PASS  apps/timeoff-service/test/integration/balance.integration.spec.ts
 PASS  apps/timeoff-service/test/integration/requests.integration.spec.ts
 PASS  apps/timeoff-service/test/integration/sync.integration.spec.ts
 PASS  apps/timeoff-service/test/e2e/happy-path.e2e.spec.ts
 PASS  apps/timeoff-service/test/e2e/hmac-validation.e2e.spec.ts
 PASS  apps/timeoff-service/test/e2e/concurrency.e2e.spec.ts
 PASS  apps/timeoff-service/test/e2e/idempotency.e2e.spec.ts
 PASS  apps/timeoff-service/test/e2e/hcm-failure.e2e.spec.ts
 PASS  apps/timeoff-service/test/e2e/reconciliation.e2e.spec.ts
 PASS  apps/timeoff-service/test/e2e/anniversary-event.e2e.spec.ts

Test Suites: 14 passed, 14 total
Tests:       50 passed, 50 total
Snapshots:   0 total
Time:        6.86 s
```

### 2. Watch Mode (For TDD)

```bash
npm run test:watch
```

Re-runs tests whenever test files change. Useful during development.

### 3. Coverage Report

```bash
npm run test:cov
```

Generates coverage report in `coverage/` directory.

**Expected Output:**
```
File                                  | % Stmts | % Branch | % Funcs | % Lines |
All files                             |  93.25  |  92.18   | 95.12   | 93.25   |
 apps/timeoff-service/src/balance    |  95.00  |  94.00   | 100     | 95.00   |
 apps/timeoff-service/src/requests   |  94.00  |  93.00   | 100     | 94.00   |
 apps/timeoff-service/src/sync       |  91.00  |  90.00   |  94     | 91.00   |
 ...
```

### 4. Run Specific Test Suites

```bash
# Unit tests only
npx jest --testPathPattern="unit"

# Integration tests only
npx jest --testPathPattern="integration"

# E2E tests only
npx jest --testPathPattern="e2e"

# Specific test file
npx jest balance.service.spec.ts
```

### 5. Test Coverage Areas

#### Unit Tests (16 tests)
- **balance.service.spec.ts**: Optimistic locking, concurrent reserves, version management
- **requests.service.spec.ts**: Request lifecycle, state transitions, HCM integration
- **sync.service.spec.ts**: Batch sync, event deduplication, balance flagging
- **reconciliation.cron.spec.ts**: Stale balance detection, reconciliation logic

#### Integration Tests (12 tests)
- **balance.integration.spec.ts**: Database transactions, optimistic lock conflicts
- **requests.integration.spec.ts**: Full request flow, DB state verification
- **sync.integration.spec.ts**: Batch processing, request flagging, deduplication

#### E2E Tests (22 tests)
- **happy-path.e2e.spec.ts**: Complete request lifecycle end-to-end
- **hmac-validation.e2e.spec.ts**: HMAC signature security validation
- **concurrency.e2e.spec.ts**: Concurrent request handling and invariants
- **idempotency.e2e.spec.ts**: Duplicate request idempotency
- **hcm-failure.e2e.spec.ts**: Error handling and resilience
- **reconciliation.e2e.spec.ts**: Scheduled reconciliation flows
- **anniversary-event.e2e.spec.ts**: Event-driven balance updates

### 6. Test Helpers

Helper functions in `test/helpers/`:

```typescript
// Generate HMAC signature
import { generateHmacSignature } from './helpers/hmac.generator';
const signature = generateHmacSignature(payload, secret);

// Seed test data
import { seedBalances, seedRequests } from './helpers/seeder';
await seedBalances(dataSource, testData);

// Mock HCM setup
import { setupHcmMock } from './helpers/hcm-mock.helper';
const adapter = setupHcmMock(responses);
```

---

## Development

### Code Organization

```
src/
├── [domain]/
│   ├── [domain].module.ts          # Module definition
│   ├── [domain].service.ts         # Business logic
│   ├── [domain].controller.ts      # HTTP endpoints
│   ├── dto/
│   │   └── [dto-name].dto.ts       # Input validation
│   └── entities/
│       └── [entity-name].entity.ts # Database models
```

### Dependency Injection Pattern

NestJS uses constructor-based dependency injection:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class MyService {
  constructor(
    @InjectRepository(MyEntity)
    private readonly repository: Repository<MyEntity>,
    @Inject('HCM_ADAPTER')
    private readonly hcmAdapter: IHcmAdapter,
    private readonly otherService: OtherService,
  ) {}
}
```

### Error Handling

Custom exceptions in `src/shared/exceptions.ts`:

```typescript
throw new InsufficientBalanceException('Not enough available days');
throw new BalanceNotFoundException('Balance not found');
throw new HcmUnavailableException('HCM system is down');
```

Global exception filter in `src/shared/timeoff-exception.filter.ts` converts exceptions to HTTP responses.

### Logging

Use NestJS logger:

```typescript
import { Logger } from '@nestjs/common';

private readonly logger = new Logger(MyService.name);

this.logger.log('Info message');
this.logger.warn('Warning message');
this.logger.error('Error message', error);
```

### Database Transactions

All balance mutations use TypeORM transactions:

```typescript
return this.dataSource.transaction(async (manager) => {
  const balance = await manager.findOne(LeaveBalanceEntity, {
    where: { ...criteria },
    lock: { mode: 'optimistic', version: currentVersion },
  });
  
  balance.totalDays += 5;
  await manager.save(balance);
});
```

### Adding New Features

1. **Create Entity**: Define `@Entity()` class in `src/domain/entities/`
2. **Create DTO**: Add `@IsNotEmpty()` decorated class in `src/domain/dto/`
3. **Create Service**: Implement business logic in `src/domain/[domain].service.ts`
4. **Create Controller**: Add HTTP endpoints in `src/domain/[domain].controller.ts`
5. **Create Module**: Export service/controller in `src/domain/[domain].module.ts`
6. **Wire in AppModule**: Import new module in `src/app.module.ts`
7. **Write Tests**: Add specs in `test/unit/`, `test/integration/`, `test/e2e/`

---

## Deployment

### Building for Production

```bash
npm install
npm run build
npm start
```

### Environment for Production

```env
NODE_ENV=production
PORT=8080
LOG_LEVEL=warn
DB_PATH=/var/lib/timeoff/timeoff.db
HCM_API_URL=https://hcm-api.company.com
HMAC_SECRET=<store-in-vault>
RECONCILE_CRON=0 2 * * *
```

### Docker Deployment (Optional)

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/apps/timeoff-service/main.js"]
```

Build and run:

```bash
docker build -t timeoff-service:1.0.0 .
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e DB_PATH=/data/timeoff.db \
  -e HCM_API_URL=https://hcm-api.company.com \
  -v /data:/data \
  timeoff-service:1.0.0
```

---

## Troubleshooting

### Issue: "Cannot find module" Error

**Problem:**
```
Error: Cannot find module '../../src/balance/balance.service'
```

**Solution:**
```bash
rm -rf dist node_modules
npm install
npm run build
```

### Issue: "Database is locked"

**Problem:**
```
Error: database is locked
```

**Solution:**
```bash
# For tests, use --runInBand flag
npm test -- --runInBand

# For production, switch to PostgreSQL
```

### Issue: "Port 3000 already in use"

**Problem:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**
```bash
# Use different port
PORT=3001 npm run start:dev

# Or kill process using port
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux:
lsof -i :3000
kill -9 <PID>
```

### Issue: "HMAC Signature Invalid"

**Problem:**
```
Error: Invalid HMAC signature
```

**Solution:**
1. Verify `HMAC_SECRET` matches client and server
2. Ensure consistent JSON serialization (no extra whitespace)
3. Use helper to generate:

```typescript
import crypto from 'crypto';

function generateHmacSignature(payload: object, secret: string): string {
  const json = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(json).digest('hex');
}
```

### Issue: "Connection Timeout"

**Problem:**
```
Error: Unable to connect to the database
```

**Solution:**
```bash
npm rebuild
node --version  # Should be 20+
```

### Debug Mode

Enable detailed logging:

```bash
npm run start:debug
# Then open Chrome DevTools: chrome://inspect
```

---

## Support & Documentation

### Key Files
- `README.md` - This file
- `.env.example` - Configuration template  
- `jest.config.js` - Test configuration
- `tsconfig.json` - TypeScript configuration
- `nest-cli.json` - NestJS CLI configuration

### API Testing with cURL

```bash
# Health check
curl http://localhost:3000/health

# Get balance
curl http://localhost:3000/balance/E001

# Create request with HMAC
PAYLOAD='{"employeeId":"E001","locationId":"NYC","leaveType":"ANNUAL","startDate":"2026-05-01","endDate":"2026-05-05","daysRequested":5,"managerId":"M001"}'
SIGNATURE=$(node -e "console.log(require('crypto').createHmac('sha256', 'dev-secret').update('$PAYLOAD').digest('hex'))")
curl -X POST http://localhost:3000/requests/create \
  -H "Content-Type: application/json" \
  -H "X-HMAC-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

---

**Last Updated:** April 24, 2026  
**Version:** 1.0.0  
**Status:** ✅ Production Ready

---

## Repository Structure

Create the following directory layout:

```
readyon-timeoff/
├── apps/
│   ├── timeoff-service/          # Main microservice
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── balance/
│   │   │   │   ├── balance.module.ts
│   │   │   │   ├── balance.controller.ts
│   │   │   │   ├── balance.service.ts
│   │   │   │   ├── entities/leave-balance.entity.ts
│   │   │   │   └── dto/balance-response.dto.ts
│   │   │   ├── requests/
│   │   │   │   ├── requests.module.ts
│   │   │   │   ├── requests.controller.ts
│   │   │   │   ├── requests.service.ts
│   │   │   │   ├── entities/time-off-request.entity.ts
│   │   │   │   └── dto/
│   │   │   │       ├── create-request.dto.ts
│   │   │   │       ├── approve-request.dto.ts
│   │   │   │       └── reject-request.dto.ts
│   │   │   ├── sync/
│   │   │   │   ├── sync.module.ts
│   │   │   │   ├── sync.controller.ts
│   │   │   │   ├── sync.service.ts
│   │   │   │   ├── reconciliation.service.ts
│   │   │   │   ├── reconciliation.cron.ts
│   │   │   │   └── dto/
│   │   │   │       ├── hcm-batch.dto.ts
│   │   │   │       └── hcm-event.dto.ts
│   │   │   ├── hcm/
│   │   │   │   ├── hcm.module.ts
│   │   │   │   ├── hcm.adapter.ts
│   │   │   │   ├── hcm.adapter.interface.ts
│   │   │   │   └── hcm-mock.adapter.ts
│   │   │   ├── audit/
│   │   │   │   ├── audit.module.ts
│   │   │   │   ├── audit.service.ts
│   │   │   │   └── entities/audit-log.entity.ts
│   │   │   └── health/health.controller.ts
│   │   └── test/
│   │       ├── unit/
│   │       ├── integration/
│   │       └── e2e/
│   └── hcm-mock-server/          # Standalone mock HCM app
│       └── src/
│           ├── main.ts
│           ├── app.module.ts
│           ├── balance/
│           │   ├── balance.controller.ts
│           │   └── balance.service.ts
│           └── simulate/simulate.controller.ts
├── README.md
└── .env.example
```

---

## Part 1: Database Entities

### 1.1 leave_balance Entity

Fields: id (uuid PK), employeeId, locationId, leaveType, totalDays (float), usedDays (float), pendingDays (float), lastSyncedAt (Date), version (@VersionColumn for optimistic locking), createdAt, updatedAt.

Add a unique index on (employeeId, locationId, leaveType).

Add a computed getter (NOT a DB column): availableDays = totalDays - usedDays - pendingDays.

### 1.2 time_off_request Entity

Fields: id (uuid PK), employeeId, locationId, leaveType, startDate (string YYYY-MM-DD), endDate (string), daysRequested (float), status (enum: PENDING | APPROVED | REJECTED | CANCELLED | HCM_FAILED | REQUIRES_REVIEW), managerId (nullable), hcmTransactionId (nullable), rejectionReason (nullable), notes (nullable), createdAt, updatedAt.

### 1.3 audit_log Entity

Fields: id (uuid PK), entityType, entityId, action, actorId (nullable), beforeState (simple-json nullable), afterState (simple-json nullable), timestamp (CreateDateColumn).

### 1.4 sync_event Entity

Fields: id (uuid PK), source (HCM_BATCH | HCM_EVENT | HCM_PULL), idempotencyKey (unique — SHA256 of payload), payload (simple-json), processedAt (nullable Date), status (PENDING | PROCESSED | FAILED), errorMessage (nullable), createdAt.

---

## Part 2: HCM Adapter

### 2.1 Interface (IHcmAdapter)

```typescript
interface IHcmAdapter {
  getBalance(employeeId: string, locationId: string, leaveType: string): Promise<HcmBalanceDto>;
  fileTimeOff(request: HcmFileTimeOffDto): Promise<HcmFileTimeOffResponseDto>;
  reverseTimeOff(hcmTransactionId: string): Promise<void>;
  getBatchBalances(): Promise<HcmBalanceDto[]>;
}
```

HcmBalanceDto: { employeeId, locationId, leaveType, totalDays, usedDays }
HcmFileTimeOffDto: { employeeId, locationId, leaveType, startDate, endDate, daysRequested, idempotencyKey }
HcmFileTimeOffResponseDto: { transactionId, status: 'SUCCESS' | 'REJECTED', rejectionReason? }

### 2.2 Real HcmAdapter

Use @nestjs/axios. Throw typed errors:
- HcmInsufficientBalanceError on 422 with INSUFFICIENT_BALANCE
- HcmInvalidDimensionError on 422 with INVALID_DIMENSION
- HcmUnavailableError on 5xx or timeout

Inject HCM_BASE_URL and HCM_TIMEOUT_MS from config. Register under injection token 'HCM_ADAPTER'.

### 2.3 HcmMockAdapter

In-memory implementation of IHcmAdapter for tests. Pre-seeded with:
- E001 / NYC / ANNUAL: total=20, used=5
- E001 / NYC / SICK: total=10, used=2
- E002 / LON / ANNUAL: total=15, used=0

---

## Part 3: Service Layer

### 3.1 BalanceService

Implement these methods with full TypeORM transaction support and optimistic lock retries (env: OPTIMISTIC_LOCK_RETRIES):

- getBalancesForEmployee(employeeId): returns all LeaveBalance rows
- getBalance(employeeId, locationId, leaveType?): throws BalanceNotFoundException if missing
- reservePendingDays(employeeId, locationId, leaveType, days, requestId): atomically increments pendingDays; checks availableDays >= days first (throws InsufficientBalanceException); uses optimistic lock retry
- confirmUsedDays(employeeId, locationId, leaveType, days): move pendingDays -> usedDays atomically
- releasePendingDays(employeeId, locationId, leaveType, days): restore pendingDays
- upsertFromHcm(hcmBalance): insert or update balance; return { balance, changed: boolean }

### 3.2 RequestsService

- createRequest(dto): (1) check balance, (2) reservePendingDays, (3) persist PENDING request, (4) audit log. Return created request.
- approveRequest(requestId, managerId): (1) load request + assert PENDING, (2) optionally re-sync HCM (SYNC_ON_APPROVE), (3) re-check balance, (4) call HCM fileTimeOff with idempotencyKey=requestId, (5) on HCM error: releasePendingDays + set REJECTED, (6) on HCM timeout: set HCM_FAILED, (7) on success: confirmUsedDays + set APPROVED + store hcmTransactionId, (8) DEFENSIVE: re-fetch HCM balance after approval, log BALANCE_ANOMALY if drift detected.
- rejectRequest(requestId, managerId, reason): releasePendingDays, set REJECTED.
- cancelRequest(requestId, actorId): if APPROVED call HCM reverseTimeOff + decrement usedDays; if PENDING releasePendingDays. Set CANCELLED.
- listRequests(filters): filter by employeeId, status.
- getRequest(requestId): throws RequestNotFoundException if missing.

### 3.3 SyncService

- processBatch(balances[]): upsert all balances; for each decreased balance find PENDING requests exceeding new availableDays and set REQUIRES_REVIEW.
- processHcmEvent(event): compute SHA256 idempotencyKey, check for duplicate in sync_event table, skip if found, otherwise upsert balance and flag REQUIRES_REVIEW requests.
- pullBalance(employeeId, locationId, leaveType): call HCM getBalance, upsertFromHcm, return updated.

### 3.4 ReconciliationCron

@Cron every 6 hours. Query leave_balance where lastSyncedAt < NOW() - 6 hours. Pull each from HCM. Log { checked, updated, errors }.

---

## Part 4: Controller Layer

### 4.1 BalanceController

- GET /api/employees/:employeeId/balances
- GET /api/employees/:employeeId/balances/:locationId

Response must include computed availableDays (not from DB column).

### 4.2 RequestsController

- POST /api/time-off/requests
- GET /api/time-off/requests?employeeId=&status=
- GET /api/time-off/requests/:requestId
- DELETE /api/time-off/requests/:requestId (actorId from X-Actor-Id header)
- POST /api/time-off/requests/:requestId/approve (managerId from body)
- POST /api/time-off/requests/:requestId/reject (managerId + reason from body)

### 4.3 SyncController

- POST /api/sync/hcm/batch — validate HMAC signature header X-HCM-Signature (HMAC-SHA256 of raw body with HCM_BATCH_SECRET). Return 401 if invalid.
- POST /api/sync/hcm/event — same HMAC validation
- POST /api/sync/pull/:employeeId/:locationId/:leaveType

### 4.4 HealthController

- GET /api/health → { status, db, lastSync, hcmReachable }

---

## Part 5: Exception Filter

Global TimeOffExceptionFilter mapping:

| Exception | HTTP | Code |
|---|---|---|
| InsufficientBalanceException | 422 | INSUFFICIENT_BALANCE |
| InvalidHcmDimensionException | 422 | INVALID_HCM_DIMENSION |
| RequestNotFoundException | 404 | REQUEST_NOT_FOUND |
| BalanceNotFoundException | 404 | BALANCE_NOT_FOUND |
| InvalidStateTransitionException | 409 | INVALID_STATE_TRANSITION |
| HcmUnavailableException | 503 | HCM_UNAVAILABLE |
| OptimisticLockException | 409 | BALANCE_CONFLICT |

All responses: { statusCode, error, message, requestId } where requestId comes from X-Request-Id header or generated UUID.

---

## Part 6: Mock HCM Server (apps/hcm-mock-server)

Standalone NestJS app. In-memory store. Start with npm run start:mock on port 3001.

Endpoints:

GET /hcm/balances/:employeeId/:locationId/:leaveType
POST /hcm/time-off — validate balance, deduct, return { transactionId, status }; IDEMPOTENT by idempotencyKey
DELETE /hcm/time-off/:transactionId — reverse deduction
GET /hcm/batch/balances — return full in-memory corpus
POST /hcm/simulate/anniversary — { employeeId, locationId, leaveType, bonusDays } — adds to totalDays
POST /hcm/simulate/year-reset — { employeeId, locationId, leaveType, newTotalDays } — resets balance
POST /hcm/simulate/error — { failNextRequests: number } — forces next N calls to fail with 500
POST /hcm/simulate/set-balance — { employeeId, locationId, leaveType, totalDays, usedDays } — direct setter for test setup
POST /hcm/simulate/reset — resets all state to initial seeds

---

## Part 7: Full Test Suite

Coverage gate in jest.config.js: lines >= 90, branches >= 90.

### Unit Tests (test/unit/)

**balance.service.spec.ts** — Test every method. Key scenarios:
- reservePendingDays: success, InsufficientBalanceException, optimistic lock retry recovers after 1 conflict, throws after max retries
- confirmUsedDays: correctly moves pending to used
- releasePendingDays: correctly decrements pending
- upsertFromHcm: creates new, updates existing, changed=true when different, changed=false when same

**requests.service.spec.ts** — Key scenarios:
- createRequest: happy path, insufficient balance, balance not found
- approveRequest: HCM success full flow, HCM INSUFFICIENT_BALANCE -> REJECTED + pendingDays restored, HCM INVALID_DIMENSION -> REJECTED, HCM timeout -> HCM_FAILED, re-sync reduces balance -> REJECTED before HCM call, defensive re-check detects anomaly -> BALANCE_ANOMALY audit entry created
- rejectRequest: happy path, invalid state transition throws
- cancelRequest: cancel PENDING, cancel APPROVED (HCM reverse called), cancel REJECTED throws

**sync.service.spec.ts** — Key scenarios:
- processBatch: updates changed, skips unchanged, sets REQUIRES_REVIEW on balance decrease
- processHcmEvent: processes new event, deduplicates exact same idempotencyKey
- pullBalance: fetches and upserts

**reconciliation.cron.spec.ts** — stale balances pulled, fresh skipped

### Integration Tests (test/integration/)

Use @nestjs/testing + in-memory SQLite (synchronize: true). Inject HcmMockAdapter.

**balance.integration.spec.ts**:
- Full DB round-trip: upsert balance, read back, availableDays computed correctly
- Optimistic lock race: 10 concurrent reservePendingDays calls of 2 days against 10-day budget; verify exactly 5 succeed, 5 fail, final pendingDays = 10

**requests.integration.spec.ts**:
- Full create -> approve -> verify DB (usedDays incremented, pendingDays = 0)
- Full create -> reject -> verify DB (pendingDays restored)
- Full create -> approve -> cancel -> verify DB (usedDays back to 0)
- GET /api/time-off/requests/nonexistent -> 404
- POST with daysRequested > available -> 422

**sync.integration.spec.ts**:
- Batch creates missing balance rows
- Batch update flags PENDING requests as REQUIRES_REVIEW when balance decreases
- Duplicate HCM event applied twice: balance changed only once

### E2E Tests (test/e2e/)

Use Supertest. Start NestJS test app with real SQLite temp DB + in-process HcmMockAdapter reset before each test.

**happy-path.e2e.spec.ts**:
Step-by-step: pull sync -> submit request -> verify pendingDays locked -> approve -> verify usedDays incremented, pendingDays cleared -> cancel -> verify usedDays restored via HCM reversal.

**anniversary-event.e2e.spec.ts**:
Submit request fails (insufficient balance) -> HCM anniversary event increases totalDays -> sync event received -> submit request succeeds.

**reconciliation.e2e.spec.ts**:
2 PENDING requests exist -> HCM batch reports lower balance -> both requests flagged REQUIRES_REVIEW.

**hcm-failure.e2e.spec.ts**:
Simulate HCM error -> approval sets HCM_FAILED -> retry approval -> succeeds -> APPROVED.

**concurrency.e2e.spec.ts**:
10-day budget. 5 concurrent requests of 3 days each (15 total). Assert balance invariant: pendingDays + usedDays <= totalDays at all times. Assert at least 3 requests succeed.

**idempotency.e2e.spec.ts**:
Same HCM event payload POST twice. Balance increased by bonusDays exactly once.

**hmac-validation.e2e.spec.ts**:
POST /api/sync/hcm/batch without signature -> 401.
POST with wrong signature -> 401.
POST with correct HMAC-SHA256 signature -> 200.

### Test Helpers (test/helpers/)

Create: seed-balance.helper.ts, seed-request.helper.ts, hcm-mock.helper.ts (reset state), hmac.helper.ts (generate valid X-HCM-Signature).

---

## Part 8: Configuration

.env.example:
```
HCM_BASE_URL=http://localhost:3001
HCM_BATCH_SECRET=supersecretkey
HCM_TIMEOUT_MS=5000
SYNC_ON_APPROVE=true
RECONCILE_CRON=0 */6 * * *
OPTIMISTIC_LOCK_RETRIES=3
DB_PATH=./data/timeoff.sqlite
PORT=3000
MOCK_HCM_PORT=3001
```

Use @nestjs/config with Joi validation schema.

---

## Part 9: README.md

Include:
1. Project overview and ASCII architecture diagram
2. Prerequisites (Node 20+, npm)
3. Setup and .env config
4. npm run start:dev — main service
5. npm run start:mock — mock HCM
6. npm test — all tests
7. npm run test:cov — coverage report (must show >= 90%)
8. Key design decisions section covering: optimistic locking, defensive HCM re-check, REQUIRES_REVIEW state, idempotency via SHA256
9. Full API reference with curl examples

---

## Part 10: package.json Scripts

```json
"scripts": {
  "build": "nest build",
  "start": "nest start",
  "start:dev": "nest start --watch",
  "start:mock": "nest start hcm-mock-server --watch",
  "test": "jest --runInBand",
  "test:watch": "jest --watch",
  "test:cov": "jest --coverage --runInBand",
  "test:e2e": "jest --config jest-e2e.config.js --runInBand",
  "lint": "eslint \"{src,apps,libs,test}/**/*.ts\"",
  "format": "prettier --write \"src/**/*.ts\""
}
```

---

## Absolute Rules

1. TypeScript strict mode everywhere.
2. All services injected via NestJS DI — no direct instantiation.
3. HCM adapter always injected via 'HCM_ADAPTER' token.
4. All balance mutations inside TypeORM transactions.
5. availableDays NEVER stored in DB — always computed.
6. Optimistic locking on all balance writes — version column + retry.
7. audit_log is append-only — no UPDATE or DELETE.
8. Idempotency on all inbound HCM data — SHA256 deduplication.
9. HMAC signature validation on /api/sync/* endpoints.
10. Jest coverageThreshold: lines 90, branches 90.
11. Every test file has a top comment describing what invariant it guards.
12. Zero TODO stubs — every method fully implemented.

---

## Generation Order

Generate in this order:
1. Root package.json, nest-cli.json, tsconfig.json, jest configs
2. All entities
3. All DTOs and exception classes
4. HCM adapter interface + real adapter + mock adapter
5. AuditService
6. BalanceService + BalanceController
7. RequestsService + RequestsController
8. SyncService + SyncController + ReconciliationCron
9. HealthController
10. AppModule wiring everything together
11. Mock HCM server (separate app)
12. All unit tests
13. All integration tests
14. All E2E tests + helpers
15. README.md + .env.example