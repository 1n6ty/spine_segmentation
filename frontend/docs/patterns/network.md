# Network

## `core/network/client.ts`

Three wrappers, no fetch client library. Always same-origin (frontend and API share one origin —
no CORS, see `AGENTS.md` root), so cookies travel by default without extra config.

| Function | Use for |
|---|---|
| `get(path)` | Raw `Response`. No CSRF header — Django only enforces CSRF on unsafe methods. |
| `post(path, { json? , form? })` | Raw `Response`. Caller checks `.ok`/parses itself. Use for login/logout/upload where you only care about success. |
| `post_json<T>(path, payload)` | Parses and returns JSON, throws on non-2xx. Use when the response body is the thing you actually need. |

All POSTs go through `with_csrf()`, which sets `X-CSRFToken` from `getCSRFToken()`
(`core/network/csrf.ts`). That reads the `csrftoken` cookie first, falling back to a
`window.CSRF_TOKEN` embedded at initial page load — **cookie must win**: Django rotates the CSRF
token on login (`rotate_token()`, session-fixation prevention), and this is an SPA with no full
reload after login, so the embedded value goes stale the moment a user logs in.

Add a new wrapper only for a genuinely new request shape (e.g. a future `delete()`), not per
endpoint — endpoints call `post('/api/whatever/', { json: {...} })` directly.

## Server-Sent Events (`core/network/sse.ts`, `core/network/segmentation-events.ts`)

`stream_sse<T>(url)` is a generic async generator over any `text/event-stream` response: reads
the body stream, splits on `\n\n` frame boundaries, extracts `data:` lines, `JSON.parse`s, and
yields the unwrapped `envelope.data` (every backend SSE frame is one `ApiResponse`-shaped JSON
object per frame, not a raw SSE `data:`-per-field multi-line payload).
