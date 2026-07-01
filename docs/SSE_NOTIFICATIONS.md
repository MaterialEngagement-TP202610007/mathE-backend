# Real-Time Notifications — SSE Migration Guide

Replaces the `setInterval` polling approach with a persistent Server-Sent Events
connection. The server pushes events to the client the moment a background job
completes — no polling needed.

---

## What changed in the API

### Question generation — now async

| | Before | After |
|--|--------|-------|
| Method | `POST /api/questions/generate` | same |
| Response status | `201 Created` + questions array | **`202 Accepted`** + job metadata |
| Blocks until done | Yes (~10–30 s) | No (returns immediately) |
| Result delivery | HTTP response body | SSE event on `/api/notifications/stream` |

**202 response body:**
```json
{
  "message": "Generation started",
  "vakStyle": "Visual",
  "count": 5
}
```

### New endpoint — SSE stream

```
GET /api/notifications/stream
```

- Requires auth cookie (`auth_token`) — sent automatically by the browser
- Returns `Content-Type: text/event-stream`
- Stays open; server pushes events as they occur
- Server sends a `: ping` comment every 25 s to prevent proxy timeouts

**URL to use:**
- **Vite dev proxy** (localhost): `/api/notifications/stream` (relative — proxy handles it)
- **Direct / production**: `https://your-backend.com/api/notifications/stream`

> If using Vite proxy, make sure `vite.config.ts` has `timeout: 0` and removes `accept-encoding` header:
> ```ts
> proxy: {
>   '/api': {
>     target: 'http://localhost:3000',
>     changeOrigin: true,
>     configure: (proxy) => {
>       proxy.on('proxyReq', (req) => req.removeHeader('accept-encoding'));
>     },
>   },
> }
> ```

---

## Frontend — before vs after

### Before (polling with setInterval)

```typescript
// Polling every N seconds — replace this completely
const intervalId = setInterval(async () => {
  const res = await fetch("/api/notifications", { credentials: "include" });
  const data = await res.json();
  // update UI...
}, 5000);

// cleanup
clearInterval(intervalId);
```

### After (SSE with EventSource)

```typescript
// Use relative URL when running through Vite proxy (localhost dev)
const es = new EventSource("/api/notifications/stream", {
  withCredentials: true, // sends the auth_token cookie
});

// Must use addEventListener, NOT es.onmessage (that only catches unnamed events)
es.addEventListener("notification", (e: MessageEvent) => {
  const payload = JSON.parse(e.data);

  if (payload.type === "question_generated") {
    // fired per question as it completes
    showToast(`Pregunta ${payload.vakStyle} lista: #${payload.questionId}`);
    refetchQuestions(); // reload list to show the new question
  }

  if (payload.type === "question_failed") {
    showToast("Una pregunta falló al generarse.", "error");
  }
});

es.onerror = () => {
  // EventSource reconnects automatically — no manual retry needed
  console.warn("SSE connection lost, browser will reconnect...");
};

// Cleanup on component unmount / logout
es.close();
```

---

## SSE Event reference

All events arrive on the `notification` named event. Events now fire **per question**, not once at the end of the batch.

### `question_generated`

Fired each time a single question is created successfully. May fire multiple times per `POST /generate` call.

```json
{
  "type": "question_generated",
  "questionId": 42,
  "vakStyle": "Visual"
}
```

### `question_failed`

Fired each time a single question fails to generate (Gemini error, duplicate rejection, etc.).

```json
{
  "type": "question_failed",
  "vakStyle": "Visual"
}
```

---

## Complete flow diagram

```
Teacher                  Backend                         DB / Gemini
  |                         |                                |
  |-- POST /generate ------>|                                |
  |<-- 202 Accepted --------|                                |
  |                         |-- [background] generateQ() -->|  (5 in parallel)
  |<-- SSE question_generated (id=1)                         |
  |<-- SSE question_generated (id=2)                         |
  |<-- SSE question_failed                                   |  (one failed)
  |<-- SSE question_generated (id=4)                         |
  |<-- SSE question_generated (id=5)                         |
  |                         |-- save notification to DB ---->|  (batch summary)
```

---

## Debugging checklist — notifications not appearing

Work through these in order before looking at anything else.

**1. Wrong event listener method**

```typescript
// ❌ WRONG — onmessage only fires for unnamed events (no "event:" line)
es.onmessage = (e) => { ... };

// ✅ CORRECT — server sends named "notification" events
es.addEventListener("notification", (e) => { ... });
```

**2. EventSource opened too late**

The server has **no buffer**. If your component opens the `EventSource` on button click (after `POST /generate`), events for fast-generating questions may fire before the connection handshake completes and are **permanently lost**.

```typescript
// ❌ WRONG — opens connection at click time, too late
const handleGenerate = () => {
  fetch("/api/questions/generate", { method: "POST", ... });
  const es = new EventSource("/api/notifications/stream", ...); // race!
};

// ✅ CORRECT — open at component mount, keep alive
useEffect(() => {
  const es = new EventSource("/api/notifications/stream", { withCredentials: true });
  // ...
  return () => es.close();
}, []);
```

**3. EventSource reconnecting on every render (unstable callback)**

If you pass `onEvent` as a `useEffect` dependency and it's not a stable reference, the effect re-runs on every render — closing and reopening the connection constantly.

```typescript
// ❌ WRONG — onEvent as dependency closes EventSource on every render
useEffect(() => {
  const es = new EventSource(...);
  es.addEventListener("notification", () => onEvent(...));
  return () => es.close();
}, [onEvent]); // if onEvent changes → closes → reconnects → misses events

// ✅ CORRECT — useRef holds latest callback; effect runs once
const onEventRef = useRef(onEvent);
onEventRef.current = onEvent; // always latest, without being a dep

useEffect(() => {
  const es = new EventSource("/api/notifications/stream", { withCredentials: true });
  es.addEventListener("notification", (e: MessageEvent) => {
    try { onEventRef.current(JSON.parse(e.data)); } catch {}
  });
  return () => es.close();
}, []); // empty deps — create once on mount, close on unmount
```

**4. Wrong URL**

```typescript
// ❌ WRONG in dev — bypasses Vite proxy, cookie may not be sent
new EventSource("http://localhost:3000/api/notifications/stream", ...);

// ✅ CORRECT — relative URL goes through Vite proxy → same origin
new EventSource("/api/notifications/stream", { withCredentials: true });
```

**5. Verify the connection is open**

In DevTools → Network → filter "EventStream". You should see a persistent `/api/notifications/stream` entry with status 200 and a stream of `: ping` comments every 25 s. If it's missing, the `EventSource` was never created or was closed immediately.

---

## React integration example

```typescript
// hooks/useNotificationStream.ts
import { useEffect, useRef } from "react";

type NotificationPayload =
  | { type: "question_generated"; questionId: number; vakStyle: string }
  | { type: "question_failed"; vakStyle: string };

export function useNotificationStream(
  onEvent: (payload: NotificationPayload) => void
) {
  // useRef keeps the latest callback without making it a useEffect dependency.
  // This prevents the EventSource from closing and reconnecting on every render.
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    // Open at mount — NOT on button click. Events can fire within seconds
    // of POST /generate; the connection must already be established.
    const es = new EventSource("/api/notifications/stream", {
      withCredentials: true,
    });

    // MUST use addEventListener("notification") — NOT es.onmessage.
    // onmessage only catches unnamed events; this server sends named "notification" events.
    es.addEventListener("notification", (e: MessageEvent) => {
      try {
        onEventRef.current(JSON.parse(e.data));
      } catch {
        // malformed payload — ignore
      }
    });

    es.addEventListener("error", () => {
      if (es.readyState === EventSource.CLOSED) {
        // 401/403 — bad credentials, don't retry
        es.close();
      }
      // CONNECTING → browser retries automatically, nothing to do
    });

    return () => es.close();
  }, []); // empty deps — create once, close on unmount
}
```

```typescript
// Usage in component
function TeacherDashboard() {
  const { refetchQuestions } = useQuestionsQuery();

  const handleNotification = useCallback((payload) => {
    if (payload.type === "question_generated") {
      toast.success(`Pregunta ${payload.vakStyle} generada`);
      refetchQuestions(); // reload list each time a new question arrives
    }
    if (payload.type === "question_failed") {
      toast.error(`Una pregunta ${payload.vakStyle} falló al generarse`);
    }
  }, [refetchQuestions]);

  useNotificationStream(handleNotification);

  // ...
}
```

---

## Behavioral notes

| Scenario | Behavior |
|----------|----------|
| Teacher closes tab while generating | Job continues in background; notification delivered on next reconnect (via DB polling on reconnect or re-open) |
| Network interruption | `EventSource` reconnects automatically — no code needed |
| Teacher has 2 tabs open | Both receive the push event |
| Teacher is logged out | `EventSource` with expired cookie gets `401`; close the connection on auth errors |
| Render.com restart / redeploy | SSE connections drop; browser reconnects; in-flight jobs that were running are lost (Gemini calls do not survive process restart) |

### Auth error handling

```typescript
es.addEventListener("error", () => {
  if (es.readyState === EventSource.CLOSED) {
    // connection rejected (401/403) — don't retry with bad credentials
    es.close();
  }
  // if readyState is CONNECTING, browser is already retrying — do nothing
});
```
``
---

## What to keep from the old polling approach

The `GET /api/notifications` and `GET /api/notifications/unread-count` REST
endpoints still exist. Keep using them for:

- **Initial load**: fetch notification history when the page mounts
- **Unread badge**: load the count on app start before the SSE connection opens
- **Mark as read**: `PATCH /api/notifications/:id/read` and `PATCH /api/notifications/read-all`

The SSE stream complements the REST endpoints — it does not replace them.
