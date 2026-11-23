# Cloud Sync

← [Design](../design.md)

## Overview

Progress is saved in two places simultaneously:

1. **On-device** — `localStorage` via NgRx SignalStore. All interactions write here immediately with zero latency. The child never waits for a network response.
2. **Cloud** — AWS DynamoDB via a REST API, synced in the background. Enables progress to survive a device change, app reinstall, or family switching between devices.

The app is **local-first**: the device is always the source of truth during a session. The cloud is a durable backup and cross-device bridge.

Only word progress (`UserWordState`) is synced. `UserSettings` stay on the device in this version.

## Sync Strategy

**On interaction (flashcard answer, manual override):**
1. Write to `localStorage` immediately — UI updates at once
2. Mark the `UserWordState` record as dirty (`syncStatus: 'pending'`)
3. `SyncService` picks up pending records and batches them to the API (debounced, max 30s delay)

**On app load:**
1. Load from `localStorage` first — app is usable instantly
2. Fetch the full `UserWordState` list for the user from DynamoDB
3. Merge using **last-write-wins** on `updatedAt` timestamp — whichever record was written more recently wins
4. Write the merged result back to `localStorage`

**Offline behavior:**
- All interactions work normally offline; dirty records accumulate
- When connectivity is restored, `SyncService` flushes all pending records
- No data is lost; no interaction is blocked

**Conflict resolution rule:**
```
if (cloudRecord.updatedAt > localRecord.updatedAt) → use cloud
else → use local (and push local to cloud)
```

The server enforces the same rule. A write whose `updatedAt` is not newer than the stored record is rejected, and the response carries the newer cloud record. The client adopts that record and marks its local copy as synced. This stops a stale device from overwriting newer progress. See [Cloud Infrastructure](infrastructure.md).

`updatedAt` is generated on the client. A device with a wrong clock can win conflicts it should lose. This is accepted for this version.

**Field mapping:** the client represents "no override" as `null`. The API and DynamoDB use the string `"none"`. `SyncService` converts between them at the API boundary.

**First sign-in:** when the parent signs in for the first time, all local records are pushed and merged by the same rule.

## Client SyncService

Located at `src/shared/sync/sync.service.ts`. Works identically on web and Capacitor (device-agnostic HTTP calls via the browser `fetch` API, which Capacitor inherits).

```ts
interface SyncService {
  // Called on app start — pulls cloud state and merges with local
  syncOnLoad(): Promise<void>

  // Called after any confidence update — marks record dirty and schedules flush
  markDirty(wordId: string): void

  // Flushes all pending dirty records to the API (called by debounced timer and on app background)
  flush(): Promise<void>
}
```

`SyncService` is a no-op when the user is not signed in (`userId` is null). It activates once the parent taps **Save to Cloud** in settings and signs in. Logging out turns it off.

### Sync status and refresh

`SyncService` also reports a status through an optional `onStatus` callback, and has a `refresh()` method:

```ts
interface SyncStatusInfo {
  syncing: boolean            // a pull or push is running
  lastSyncedAt: string | null // ISO 8601; set when a pull or push succeeds; null until then
  error: string | null        // plain-language message, or null when the last sync worked
}
// refresh(): flush pending records, then pull and merge. One run at a time; never throws
```

- The app keeps this status in a `SyncStatusService` (signals) that the settings panel reads. It is held in memory. The pull on app load fills in `lastSyncedAt` again after a reload
- Push and pull errors are tracked separately. The visible `error` is the push error if there is one, else the pull error. A success clears only its own kind
- A pull or push that fails never changes local data
- A refresh while another sync is running joins that run instead of starting a second one
- Messages are listed in [Error Handling](../ux/error-handling.md)

### Known cause of devices not matching

Progress changes reach other devices only through a pull, and a pull ran only on app load or sign-in. A device left open never saw changes from another. The refresh icon fixes this on demand.

A second cause is a record with an empty `lastSeenAt`. A parent override on a word the child has never seen leaves `lastSeenAt` as `""`. The API rejected the whole 25-record batch with a 400 because `lastSeenAt` must be an ISO date, and the client then retried the same batch forever, so later records never sent. The API now accepts `""` for `lastSeenAt`, and the client skips a refused batch and sends the rest.

Signing in sets `cloudSyncEnabled` to true on every device, so a second device no longer needs a separate switch to start syncing.

---

Backend resources (DynamoDB, API, Cognito, CDK) are described in [Cloud Infrastructure](infrastructure.md).
