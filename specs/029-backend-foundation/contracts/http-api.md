# HTTP API Contract: v1

Design contract; endpoints are not implemented yet. All bodies are UTF-8 JSON. Account, session and
progress responses use Cache-Control: no-store. The server derives the account from its session;
there is no client-selected account ID in progress URLs or request bodies.

## Browser Transport

Browser requests use credentials: include. Every mutation requires an exact configured Origin and
X-CyberFishing-Client: browser. Missing, null or untrusted origins and missing/wrong headers return
403. This header is a CSRF transport requirement, not an authentication secret.

Requests with bodies require application/json; simple form/text content types return 415.
Credentialed CORS allows only explicitly configured origins, methods and headers, including
If-Match and X-CyberFishing-Client. Responses vary by Origin and expose ETag. OPTIONS preflight
does not require an authenticated session and never executes a use case.

Production cookie: __Host-cf_session; HttpOnly; Secure; SameSite=Lax; Path=/; no Domain attribute.
Local HTTP development uses a distinct cf_dev_session cookie through an explicit development mode.
Production configuration rejects insecure cookie settings. Production browser/API topology must be
same-site or same-origin as described in [research.md](../research.md).

## Endpoints

| Method / path | Access | Success |
| --- | --- | --- |
| GET /health/live | Public | 200, {"status":"ok"} |
| GET /health/ready | Public | 200 when required storage/schema are ready; 503 otherwise |
| POST /v1/accounts | Mutation guard | 201, public account; registration does not sign in |
| POST /v1/sessions | Mutation guard | 200, public account and new session cookie |
| GET /v1/session | Session | 200, public account |
| DELETE /v1/session | Mutation guard | 204; revoke current session if present and clear cookie |
| GET /v1/progress | Session | 200, record with ETag; 404 when no record exists |
| PUT /v1/progress | Session + mutation guard + revision | 200, committed record with new ETag |

Logout is idempotent for missing or expired sessions. A storage failure cannot be reported as a
successful revocation of a live session. Health responses do not reveal credentials or internal
exceptions. Readiness is false during draining and when schema compatibility cannot be established.

## Accounts

Registration and sign-in bodies contain exactly login and password. Account bodies are limited to
4 KiB. Login is 3-32 ASCII letters, digits or underscore and normalized to lowercase. Password is
15-128 Unicode code points and at most 512 UTF-8 bytes, with no trimming or normalization.

Public account response:

```json
{"accountId":"server-generated-uuid","login":"player_1"}
```

Duplicate registration returns 409 LOGIN_UNAVAILABLE. Unknown login and incorrect password both
return 401 INVALID_CREDENTIALS with the same public message. Protected requests without a valid,
unexpired session return 401 UNAUTHENTICATED. Password hashes and raw session tokens are never JSON
response fields. Login, registration and progress writes have bounded rate limits.

## Progress and Concurrency

GET returns exactly revision, formatVersion, clientGameVersion, updatedAt and snapshot. updatedAt
is a server-generated UTC timestamp. The ETag is the quoted decimal revision, for example "7".
Stored snapshot facts must pass validation before they are returned.

PUT contains exactly formatVersion, clientGameVersion and snapshot, as specified in
[progress-format.md](progress-format.md). It cannot set owner, revision or acknowledged timestamp.
If-Match contains one quoted, nonnegative safe integer. Revision "0" means create only if absent;
positive revisions mean update only the matching current record.

- Missing If-Match: 428 REVISION_REQUIRED.
- Invalid, wildcard, weak, multiple or unsafe revision: 400 INVALID_REVISION.
- Current revision differs, including a concurrent first creation: 412 REVISION_CONFLICT.
- Successful write: acknowledge only after database commit, increment revision exactly once.

A conflict may return currentRevision for the authenticated account. It never returns another
account's metadata. The client preserves pending local data; it does not silently merge, rebase
or retry against a newly fetched revision. An uncertain acknowledgement requires a read before
choosing the next action. API v1 uses an application-specific absent-record precondition "0".

## Error Envelope

```json
{"error":{"code":"REVISION_CONFLICT","message":"Saved progress has changed."},"requestId":"opaque-request-id"}
```

Validation errors may add bounded field/path metadata, without echoing submitted secret values.

| Status | Meaning |
| --- | --- |
| 400 | Invalid input, JSON or header |
| 401 | Invalid credentials or unauthenticated session |
| 403 | Origin/custom-header guard failed |
| 404 | Authenticated account has no cloud progress |
| 409 | Login unavailable |
| 412 | Revision conflict |
| 413 | Body limit exceeded |
| 415 | Unsupported media type |
| 422 | Unsupported progress version or invalid progress structure |
| 428 | Revision precondition required |
| 429 | Rate limit reached |
| 500 | Controlled unexpected error or corrupt stored snapshot |
| 503 | Required storage or bounded hashing capacity unavailable |

Logs contain request ID, route, result and safe operational metadata. Request bodies, passwords,
Cookie/Set-Cookie, session tokens and database connection strings are redacted. Exceptions are not
serialized to clients. Infrastructure failures leave acknowledged progress unchanged.
