# Error Handling

← [Design](../design.md)

Errors are categorized by severity and surfaced with the appropriate UI treatment. The child-facing session UI never shows a raw error message. All user-facing error text is plain language written for a parent, not a developer.

## Error categories and treatments

| Category | Examples | Treatment |
|---|---|---|
| **Field validation** | Sign-in email invalid, empty required field | Inline field error — red helper text beneath the input, no modal |
| **Recoverable background** | Sync flush failed, single API call timed out | Toast notification — appears briefly in a corner, auto-dismisses after 4s, does not interrupt the session |
| **Recoverable foreground** | Sign-in failed (wrong password), token refresh failed | Modal dialog — brief message with one action button (e.g. "Try again" or "Sign in again") |
| **Session-blocking** | App failed to load word content, localStorage unavailable | Full-screen error state — friendly message, single retry button; never shows a stack trace |
| **Silent** | Sync retry exhausted after 3 attempts, non-critical asset load failure | Log to console only; dirty records remain in queue and retry on next app open; image falls back to category emoji |

## Specific error behaviors

**Audio file missing or fails to load:**
Resolves silently. No sound plays. No UI change. The session continues normally. This is expected during development when audio files are not yet recorded.

**Image file missing or fails to load:**
The word image area displays the category emoji (e.g. 🐾) at large size on the session background color. The session continues. This is a graceful fallback, not an error state.

**API call fails (sync):**
Toast appears: *"Progress not saved to cloud — will retry."* The record stays dirty in localStorage and is retried on the next sync cycle or app open.

**Sync write rejected because the cloud has a newer record:**
No message. The client adopts the newer cloud record and marks the local record as synced. See [Cloud Sync](../cloud/sync.md).

**Cognito token expired mid-session:**
Amplify Auth silently refreshes the token in the background. If refresh fails, `SyncService` pauses and a toast appears: *"Signed out — your progress is saved on this device."* The session is not interrupted.

**No internet connection:**
No error shown. The app works fully offline. Sync pauses silently. When connectivity returns, `SyncService` resumes automatically.

**Content JSON fails to parse (corrupted or missing):**
Full-screen error state: *"Something went wrong loading the words. Please refresh."* with a Reload button. This is the only scenario where the app cannot function at all.
