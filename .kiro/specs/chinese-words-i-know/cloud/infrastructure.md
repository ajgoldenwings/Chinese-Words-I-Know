# Cloud Infrastructure

← [Design](../design.md)

Client sync behavior is described in [Cloud Sync](sync.md).

## AWS Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Client (web / iOS / Android)        │
│                                                          │
│  NgRx SignalStore ──► SyncService ──► API Gateway (HTTPS)│
│  (localStorage)        (background)                      │
└─────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   Amazon Cognito   │
                    │   (User Pools)     │
                    │   JWT auth token   │
                    └─────────┬──────────┘
                              │ authorizes
                    ┌─────────▼──────────┐
                    │  API Gateway       │
                    │  HTTP API          │
                    │  GET  /progress    │
                    │  PUT  /progress    │
                    └────┬──────────┬────┘
                         │          │
              ┌──────────▼──┐  ┌────▼──────────┐
              │  Lambda     │  │  Lambda        │
              │  GetProgress│  │  PutProgress   │
              └──────────┬──┘  └────┬───────────┘
                         │          │
                    ┌────▼──────────▼────┐
                    │     DynamoDB       │
                    │  (single table)    │
                    │  PK: userId        │
                    │  SK: wordId        │
                    └────────────────────┘
```

## DynamoDB Table Design

**Table name:** `chinese-words-progress`

**Single-table layout:**

| Attribute | Type | Description |
|---|---|---|
| `userId` (PK) | String | Cognito `sub` — unique per user |
| `wordId` (SK) | String | Word slug e.g. `mao` |
| `confidenceScore` | Number | `0.0` – `1.0` |
| `timesSeenCount` | Number | Total answered prompts where this word was the target |
| `lastSeenAt` | String | ISO 8601 timestamp |
| `manualOverride` | String | `"known"` \| `"unknown"` \| `"none"` |
| `updatedAt` | String | ISO 8601 timestamp of last write — used for conflict resolution |

**Access patterns:**

| Pattern | Operation | Key condition |
|---|---|---|
| Load all progress for a user | `Query` | `PK = userId` |
| Write word state | Conditional `PutItem` (up to 25, in parallel) | `PK = userId`, `SK = wordId`; condition `attribute_not_exists(wordId) OR updatedAt < :updatedAt` |

**No GSI needed** — all queries are by `userId` only.

`BatchWriteItem` is not used because it cannot take conditions, and the condition is what keeps an older record from overwriting a newer one.

The client represents "no override" as `null`. The API and DynamoDB use `"none"`; `SyncService` maps between them.

## API Endpoints

**Base URL:** `https://<api-id>.execute-api.<region>.amazonaws.com`

All endpoints require a valid Cognito JWT in the `Authorization` header (`Bearer <token>`). The `userId` is extracted from the token — it is never passed as a parameter.

### `GET /progress`
Returns all `UserWordState` records for the authenticated user.

**Response:**
```json
{
  "items": [
    {
      "wordId": "mao",
      "confidenceScore": 0.72,
      "timesSeenCount": 9,
      "lastSeenAt": "2026-11-22T14:30:00Z",
      "manualOverride": "none",
      "updatedAt": "2026-11-22T14:30:00Z"
    }
  ]
}
```

### `PUT /progress`
Upserts up to 25 `UserWordState` records. Each record is written with a condition, so an older record can never overwrite a newer one: `attribute_not_exists(wordId) OR updatedAt < :updatedAt`. The Lambda issues one conditional `PutItem` per record, in parallel, with `ReturnValuesOnConditionCheckFailure` set so a rejected write returns the record currently stored.

**Request body:**
```json
{
  "items": [
    {
      "wordId": "mao",
      "confidenceScore": 0.72,
      "timesSeenCount": 9,
      "lastSeenAt": "2026-11-22T14:30:00Z",
      "manualOverride": "none",
      "updatedAt": "2026-11-22T14:30:00Z"
    }
  ]
}
```

**Response:** `200 OK`. A record is `rejected` when the cloud already holds a newer one, and `current` is that newer record.
```json
{
  "accepted": ["mao"],
  "rejected": [
    {
      "wordId": "gou",
      "current": {
        "wordId": "gou",
        "confidenceScore": 0.80,
        "timesSeenCount": 12,
        "lastSeenAt": "2026-11-22T15:00:00Z",
        "manualOverride": "none",
        "updatedAt": "2026-11-22T15:00:00Z"
      }
    }
  ]
}
```

## Cognito Setup

- **User Pool** with email sign-in and self sign-up enabled
- **App Client** (no client secret — public client for web/mobile)
- Hosted UI is not required. The app has its own sign-up, sign-in, and password-reset screens built on Amplify Auth
- The auth token (JWT) is stored in `localStorage` after sign-in and attached to every API request
- Token refresh is handled automatically by the AWS Amplify Auth library (`aws-amplify/auth`)

### Account flows

| Flow | Behavior |
|---|---|
| Sign up | Email and password. Cognito emails a verification code, and the account is active once the code is entered |
| Sign in | Email and password |
| Forgot password | Cognito emails a reset code, and the parent sets a new password |
| Sign out | Stops sync and clears the tokens. Local progress stays on the device |

Turning `cloudSyncEnabled` on opens sign-in, with a "Create account" option. Turning it off signs out and pauses sync. Error text for these flows follows [Error Handling](../ux/error-handling.md).

**Sign-in is optional.** The app works without an account. A "Save to Cloud" toggle sits in the settings panel. Enabling it starts the Cognito flow. Until then, all data stays on-device only.

## CDK Infrastructure

**Language:** TypeScript (matches the rest of the project)

**Location:** `infra/` at the workspace root

**Two stacks:**

| Stack | Contents | Termination protection |
|---|---|---|
| `ChineseWordsStatefulStack` | DynamoDB table, Cognito User Pool + App Client | ✅ Yes |
| `ChineseWordsApiStack` | Lambda functions, API Gateway HTTP API, IAM roles | ❌ No |

The API stack takes the table ARN and User Pool ARN as props from the stateful stack — no cross-stack `Fn::ImportValue` references, passed directly as constructor props to avoid deadly-embrace deployment issues.

**Folder structure:**

```
infra/
├── bin/
│   └── app.ts                    # CDK app entry point; instantiates both stacks
├── lib/
│   ├── stateful-stack.ts         # DynamoDB + Cognito
│   └── api-stack.ts              # Lambda + API Gateway
├── lambda/
│   ├── get-progress/
│   │   └── index.ts              # GetProgress Lambda handler
│   └── put-progress/
│       └── index.ts              # PutProgress Lambda handler
├── cdk.json
├── tsconfig.json
└── package.json
```

**Key CDK construct decisions:**

- DynamoDB table uses `BillingMode.PAY_PER_REQUEST` — no capacity planning needed at this scale
- DynamoDB table has `removalPolicy: RemovalPolicy.RETAIN` — never deleted even if the stack is destroyed
- Lambda functions use `nodejs22.x` runtime with `bundling: { minify: true }` via `NodejsFunction`
- API Gateway HTTP API uses `HttpJwtAuthorizer` pointing at the Cognito User Pool — no custom Lambda authorizer needed
- `GetProgress` is granted `table.grantReadData(...)` and `PutProgress` is granted `table.grantWriteData(...)`. Least privilege
- CORS allows `https://<username>.github.io` (an origin has no path, so the repo subpath is not part of it) and `http://localhost:4200` for local development. Capacitor origins are added when mobile work begins
- The stacks export `ApiUrl`, `UserPoolId`, and `UserPoolClientId` as CloudFormation outputs. CI reads them to generate the app configuration (see [CI/CD](ci-cd.md))
