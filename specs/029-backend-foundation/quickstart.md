# Implementation and Acceptance Guide

The commands below are the planned interface after implementation. No backend package, executable
server, migration or browser account UI has been implemented by these design documents.

## Local Setup

Use the latest supported patched Node 24 LTS and the pinned npm version. Verify argon2 installation
on Windows development and target Linux. Use a disposable supported PostgreSQL database containing
no player data. The backend is installed/run from backend/ independently of the root client package.

Planned backend commands:

```powershell
Set-Location D:\dev\code\cyber-fishing\backend
npm ci
Copy-Item .env.example .env
npm run typecheck
npm run lint
npm run build
npm run db:migrate
npm run check:architecture
npm test
npm run test:integration
npm run dev
```

Configure an ignored local environment with DATABASE_URL, an exact browser origin such as
http://127.0.0.1:4173, the API listen address/port and explicit local HTTP cookie mode. Use the same
hostname consistently in local client/API URLs. Config variable names are finalized by the config
implementation and documented in .env.example. No secrets enter tracked files or client config.

Production starts compiled JavaScript through npm start. Migrations are a separate deployment step
with a dedicated database role and version/checksum ledger; HTTP startup does not modify schema.

## Accounts and Protocol

- Use two separate cookie jars to register/sign in accounts A and B. Verify distinct ownership.
- Wrong password and unknown login have the same public failure. Verify duplicate registration races.
- Verify session durability after service restart, expiry and logout revocation.
- Verify missing/untrusted/null Origin, missing custom header, simple content types, extra fields,
  oversized bodies and rate limits. Preflight must permit only configured origins/headers/methods.
- Inspect responses/logs for secret redaction; passwords, cookie tokens and connection strings are absent.

## Durable Progress

Use fixtures captured from current inventory/chum owners, including optional fields and timestamps.

1. GET without a record returns 404. PUT with If-Match: "0" creates revision 1.
2. GET returns equivalent saved facts and ETag "1"; restart and verify again.
3. Submit two concurrent different writes with If-Match: "1". Exactly one succeeds at revision 2;
   the other returns 412 and cannot change the winning facts.
4. Repeat concurrent first creation, unsupported versions, malformed references and body limits.
5. Verify account A cannot read/write B through manipulated identity fields or headers.
6. Force a storage failure and verify no successful acknowledgement or revision change.
7. Simulate a lost write response. A read establishes current state; the client does not silently
   overwrite using a newly observed precondition.

These checks run against real PostgreSQL as well as focused unit/HTTP tests. Doubles alone do not
prove SQL constraints, transactions, committed durability or concurrency.

## Process and Deployment

Verify startup failure with invalid configuration and missing/incompatible schema. Verify readiness
failure during storage outage and draining, independent of liveness. Test actual socket/process
shutdown within the 10-second deadline and cleanup of accepted requests/database resources.

Before real player deployment, configure HTTPS, actual same-site or same-origin browser/API topology,
trusted proxy handling, least-privilege database access and tested backup/restore. Confirm cookies and
credentialed CORS in the intended browser topology. Do not treat an unrelated API domain as a proven
replacement for same-site hosting.

## Browser Integration Acceptance

After the required client slice is implemented, run explicit guest import, cloud restore, two-tab
conflict resolution, account switching with pending/delayed writes, expired sessions and backend
outage. Confirm guest/legacy local data stays recoverable and gameplay/save timing is preserved.

Run focused backend/client checks, existing Architecture + Quick + Full, and production/DEV browser
smoke. Record the unchanged game-cycle digest and save round-trip evidence. The guide itself does not
constitute passing test results.
