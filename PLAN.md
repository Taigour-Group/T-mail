# tmail — Architecture & Build Plan

> First-party email for **@tgo.com**, built to back **TGO ID**.
> Stack mirrors TGO ID: Express + Supabase (server) and Vite + React 18 + Tailwind v3 (web).

---

## 1. What tmail is (two jobs)

1. **Human webmail (Gmail-like):** inbox, compose, threaded conversations, labels/folders, full-text search, attachments.
2. **Transactional backbone for TGO ID:** when a user signs into any third-party app via "Sign in with TGO," the **verification link / OTP code / security alert** is delivered through tmail to their `@tgo.com` inbox. Because every TGO ID account *is* a tmail mailbox, this loop works with internal delivery alone — no external mail server needed to verify users.

**v1 delivery scope:** internal only (`@tgo.com` ↔ `@tgo.com`). The architecture is deliberately **internet-ready** so real SMTP send/receive to Gmail/Yahoo/etc. can bolt on later *without reshaping the data model* (see §5 and §11).

---

## 2. Stack & processes (mirrors TGO ID)

| Part | Tech | Port |
|------|------|------|
| `server/` | Express 4, ESM (`"type":"module"`), Supabase service-role client | **4100** |
| `web/` | Vite + React 18 + react-router-dom v6 + Tailwind v3 | **5273** |
| Auth | tmail is an **OAuth2/OIDC client of TGO ID** (Authorization Code + **PKCE**), via `.well-known` discovery | — |

Security posture carried over from TGO ID: `helmet`, `cors` allowlist, `express-rate-limit`, `zod` validation, `jose` for JWT verification, signed httpOnly session cookie **`tmail_sid`** (parallels `tgo_sid`).

---

## 3. "Sign in with TGO" — the login flow & callback URL

tmail does **not** store passwords. It delegates login to TGO ID:

```
Browser            tmail server (4100)             TGO ID (4000)
  | click "Sign in with TGO"  |                          |
  |-------------------------->|  build PKCE + state       |
  |   302 to TGO authorize ------------------------------>| user approves
  |                           |   302 back to callback    |
  |   GET /auth/callback?code&state <---------------------|
  |                           |  exchange code+verifier   |
  |                           |------ token endpoint ----->|
  |                           |<----- id_token/access ----|
  |                           |  verify (jose), upsert mailbox
  |   Set-Cookie tmail_sid    |  redirect to /            |
  |<--------------------------|                          |
```

**Callback / redirect URI to register in the TGO ID dev console:**

```
http://localhost:4100/auth/callback      (dev)
https://mail.<yourdomain>/auth/callback   (prod)
```

Value is env-driven: **`TMAIL_REDIRECT_URI`**. You register tmail as an app in TGO ID's console, copy the **client id + secret** into tmail's `.env`, and set this exact callback. Endpoints (authorize/token/jwks) are auto-discovered from **`TGO_ISSUER`** so nothing is hardcoded.

---

## 4. Identity model

- Every TGO ID user maps to **one tmail mailbox**; the address is the user's `name@tgo.com`.
- The mailbox is **auto-provisioned on first login** from the OIDC `sub` + email claim.
- **Reserved system senders** (not user-owned): `no-reply@tgo.com` (verification/OTP), `security@tgo.com` (security alerts).

---

## 5. Data model (Supabase / Postgres)

Designed so today's internal delivery and tomorrow's internet mail share the same tables. Fields marked ⚙ exist now purely to make the internet phase a drop-in.

- **mailboxes** — `id`, `tgo_user_id` (OIDC sub), `address` (unique, `name@tgo.com`), `display_name`, `created_at`.
- **threads** — `id`, `mailbox_id`, `subject_normalized`, `last_message_at`.
- **messages** — `id`, `thread_id`, `from_address`, `subject`, `body_text`, `body_html`, `created_at`, ⚙`rfc_message_id`, ⚙`in_reply_to`, ⚙`references` (text[]). Storing RFC-style ids now = free interop later.
- **recipients** — `message_id`, `address`, `kind` (`to`|`cc`|`bcc`). Separate row per recipient.
- **mailbox_messages** — the per-mailbox *view* of a message and the unit of fan-out: `mailbox_id`, `message_id`, `system_folder` (`INBOX`|`SENT`|`DRAFT`|`TRASH`|`SPAM`), `is_read`, `is_starred`, `is_draft`. One physical message → many mailbox views (Gmail-style).
- **labels** — `mailbox_id`, `name`, `type` (`system`|`user`), `color`.
- **message_labels** — join (`mailbox_message_id`, `label_id`).
- **attachments** — `message_id`, `filename`, `mime_type`, `size_bytes`, `storage_path` (Supabase Storage bucket `tmail-attachments`).
- **search** — `tsvector` column on `messages` (subject + body_text + from_address) with a **GIN** index; Postgres full-text search, no extra service.
- ⚙ **delivery_log** (later) — outbound SMTP status per recipient.

Schema ships as `server/db/schema.sql`, run in the Supabase SQL editor (same workflow as TGO ID).

---

## 6. Delivery model — the one seam that matters

A single module `deliver(message)` decides, per recipient address:

- **internal** (`@tgo.com`, mailbox exists) → insert an `INBOX` `mailbox_messages` row.
- **external / unknown** → **v1:** reject with a clear "external mail not enabled yet" error. **later:** hand off to the outbound MTA queue.

The sender always gets a `SENT` row. Inbound internet mail (later) will call this *same* `deliver()`, so the webmail and transactional paths never change when SMTP arrives. **This abstraction is the whole reason internal-now → internet-later is cheap.**

---

## 7. Transactional / verification API (for TGO ID & other first-party apps)

A **separate machine-to-machine endpoint**, authenticated by a service token — never the user cookie:

```
POST /api/system/send
Authorization: Bearer <TMAIL_SERVICE_TOKEN>
{ "to": "alice@tgo.com", "template": "verify_login",
  "vars": { "app": "Folsom Cafe POS", "code": "492013", "link": "https://..." } }
```

- Built-in templates: **`verify_email`**, **`verify_login`** (OTP), **`security_alert`** (new device / password change).
- Sender = `no-reply@tgo.com` or `security@tgo.com`.
- Strict rate limiting + audit logging; distinct auth plane from user sessions.
- Delivers via the same `deliver()` fan-out → lands in the recipient's tmail INBOX instantly.

This is what lets TGO ID verify users who log into third-party products.

---

## 8. HTTP API (user-facing, cookie-authed)

- **auth:** `GET /auth/login`, `GET /auth/callback`, `POST /auth/logout`, `GET /auth/me`
- **threads/messages:** `GET /api/threads?folder=INBOX&label=&cursor=`, `GET /api/threads/:id`, `POST /api/messages` (send), `POST /api/drafts`, `PATCH /api/messages/:id` (read/star/move), `DELETE /api/messages/:id`
- **labels:** `GET/POST/PATCH/DELETE /api/labels`, apply/remove on a message
- **attachments:** `POST /api/attachments` (upload → Storage), `GET /api/attachments/:id` (signed URL)
- **search:** `GET /api/search?q=`

---

## 9. Web app screens

- **Login** — single "Sign in with TGO" button.
- **App shell** — left sidebar (Compose, system folders, custom labels), top search bar, message list, reading pane.
- **Thread view** — collapsible conversation.
- **Compose modal** — to/cc/bcc, subject, rich body, attachments.
- **Settings** — manage labels.

Design language matches TGO ID: monochrome + one blue accent, `@layer components` classes (`.btn*`, `.input`, `.card`, `.panel`, `.nav-item*`).

---

## 10. Security notes

- **Two auth planes, never mixed:** user (TGO ID OIDC → `tmail_sid` cookie) and service (`TMAIL_SERVICE_TOKEN`).
- Supabase **service-role key stays server-side**; never shipped to the web bundle.
- **No secrets in the repo** — only `.env.example` with placeholders.
- Rate-limit auth + `/api/system/send`. **Escape/sanitize HTML bodies** on render (stored-XSS defense). Attachments served via **short-lived signed URLs**.

---

## 11. Phased roadmap

| Phase | Deliverable |
|-------|-------------|
| **P0** | Scaffold + Sign-in-with-TGO (PKCE) + schema + mailbox auto-provision |
| **P1** | Internal send/receive, INBOX/SENT, read/unread |
| **P2** | Transactional/verification API + templates → **unblocks TGO ID email verification** |
| **P3** | Threaded conversations |
| **P4** | Labels/folders, star, trash |
| **P5** | Attachments (Supabase Storage) |
| **P6** | Full-text search (Postgres FTS) |
| **P7** *(later)* | **Internet email:** owned domain, MX/SPF/DKIM/DMARC, inbound MTA → `deliver()`, outbound queue, spam filtering |

The scaffold delivers **P0's skeleton with every later phase's data model already in place**, plus stubs for the P2 transactional endpoint.

---

## 12. What "internet email later" concretely requires

So expectations are clear, the P7 jump needs: a **real owned domain** (tgo.com is currently a placeholder), a **static IP with PTR/rDNS** and **port 25** open, an **MTA** (Haraka or Postfix), **DKIM** signing keys, **SPF + DMARC** DNS records, IP **reputation/warm-up**, and **inbound spam filtering**. None of that blocks v1; the data model and `deliver()` seam are already shaped for it.

---

## 13. Config (env) — synced with TGO ID

`EMAIL_DOMAIN` is kept identical to TGO ID's `SIGNUP_EMAIL_DOMAIN` (single source of truth for the domain). Adds: `TGO_ISSUER` (discovery URL), `TMAIL_CLIENT_ID`, `TMAIL_CLIENT_SECRET`, `TMAIL_REDIRECT_URI`, `COOKIE_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TMAIL_SERVICE_TOKEN`, `WEB_ORIGIN` (CORS). Full list ships in `server/.env.example`.
