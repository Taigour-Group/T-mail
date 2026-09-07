# T-mail Project Guide

This document is the handoff guide for T-mail. It explains what the product is, how the code is organized, how data moves through the system, which design and implementation decisions are intentional, and what still needs to be built.

## 1. Product Purpose

T-mail is first-party email for the `@tgo.com` domain and a transactional mail backbone for TGO ID.

It has two related jobs:

1. Provide a human webmail experience: inbox, folders, labels, search, threads, compose, replies, chat-mode messages, and attachments.
2. Deliver TGO ID messages such as verification links, OTP codes, and security alerts into a user's T-mail mailbox.

The current delivery scope is internal mail only. Messages between known `@tgo.com` addresses are delivered immediately inside T-mail. External delivery to Gmail, Yahoo, and other internet addresses is intentionally rejected for now, but the data model and delivery boundary are designed for future SMTP/MTA support.

The project is intended to back TGO ID. T-mail does not manage passwords or create a separate user identity system. It authenticates users through TGO ID using OIDC.

## 2. Technology Stack

| Area | Technology | Location / Port |
| --- | --- | --- |
| Web client | Vite, React 18, React Router 6, Tailwind CSS 3 | `web/`, port `5273` |
| API server | Node.js, Express 4, ESM | `server/`, port `4100` |
| Database | Supabase Postgres | server-side only |
| Authentication | TGO ID OIDC, Authorization Code + PKCE | server auth routes |
| Sessions | Signed, httpOnly `tmail_sid` cookie | server middleware |
| Validation | Zod | server routes and environment |
| Security | Helmet, CORS allowlist, rate limiting, Jose | server |
| File storage | Supabase Storage | private `tmail-attachments` bucket |

The root workspace uses npm workspaces and `concurrently`.

## 3. Repository Layout

```text
T-mail/
  package.json                 Root scripts and workspaces
  README.md                    Short project entry point
  PLAN.md                      Product architecture and roadmap
  PROJECT_GUIDE.md             This handoff document

  server/
    package.json
    db/
      schema.sql               Complete database schema
      *.sql                    Incremental database migrations
    src/
      index.js                 Express app and route registration
      env.js                   Environment validation and normalization
      middleware.js             Auth, errors, async helpers
      supabase.js               Server-side Supabase client
      lib/                     Business and delivery helpers
      routes/                  HTTP route modules

  web/
    index.html
    package.json
    vite.config.js              Dev server and API proxy
    src/
      App.jsx                   Top-level routes and auth gate
      index.css                 Tailwind imports and shared classes
      main.jsx                  React entry point
      components/               Reusable mailbox, thread, compose UI
      pages/                    Route-level screens
      lib/                      API, auth, brand, and template helpers
```

## 4. Running the Project

### Install dependencies

From the repository root:

```bash
npm install
```

The root package uses workspaces for `server` and `web`.

### Run both services

```bash
npm run dev
```

This runs:

```bash
npm run dev --prefix server
npm run dev --prefix web
```

The web app is available at `http://localhost:5273/`. The API is available at `http://localhost:4100/`.

The Vite dev server proxies `/api`, `/auth`, and `/health` to port `4100`. During startup it is possible for Vite to send a request before Express has finished listening. A first `ECONNREFUSED` proxy message can therefore be transient; check `http://localhost:4100/health` after both processes start.

### Build the web app

```bash
npm run build
```

This installs workspace dependencies and runs the Vite production build.

### Run only one service

```bash
npm run dev --prefix server
npm run dev --prefix web
npm run start
```

`npm run start` runs the server production entry point. In production, Express serves `web/dist` as the SPA after registering API and auth routes.

## 5. Environment Configuration

Copy the server example file before starting the API:

```bash
copy server/.env.example server/.env
```

Required server values include:

- `PORT` - normally `4100`.
- `WEB_ORIGIN` - normally `http://localhost:5273`.
- `EMAIL_DOMAIN` - normally `tgo.com`.
- `TGO_ISSUER` - TGO ID OIDC issuer URL.
- `TMAIL_CLIENT_ID` and `TMAIL_CLIENT_SECRET` - OIDC client credentials.
- `TMAIL_REDIRECT_URI` - normally `http://localhost:4100/auth/callback`.
- `COOKIE_SECRET` - at least 16 characters.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- `TMAIL_SERVICE_TOKEN` - infrastructure token for trusted transactional callers.
- Optional system senders: `SYSTEM_SENDER_NOREPLY` and `SYSTEM_SENDER_SECURITY`.

Secrets must stay in `server/.env`. Never expose the Supabase service-role key, OIDC client secret, cookie secret, or service token in the web bundle.

## 6. Authentication Flow

T-mail delegates identity to TGO ID:

```text
Browser
  -> GET /auth/login
  -> T-mail creates PKCE verifier and state
  -> TGO ID authorization endpoint
  -> TGO ID redirects to /auth/callback
  -> T-mail exchanges code + verifier
  -> T-mail verifies the ID token with Jose
  -> mailbox is provisioned or found
  -> signed httpOnly tmail_sid cookie is set
  -> browser returns to /
```

T-mail does not store passwords.

Each TGO ID user maps to one mailbox. The mailbox address is derived from the user's email identity and is normalized to lowercase. A mailbox can be provisioned automatically on first login. Delivery can also create a temporary shadow mailbox for an internal address that has not logged in yet; the identity is reconciled later.

There are two separate authentication planes:

1. User routes use the TGO ID session cookie and `requireUser`.
2. Transactional system routes use a bearer service token and their own rate limits.

Never mix these two mechanisms.

## 7. Server Architecture

### Express entry point

`server/src/index.js`:

1. Loads and validates environment configuration.
2. Creates the Express application.
3. Adds request IDs, Helmet, CORS, JSON parsing, and cookies.
4. Registers auth, system, user API, and production SPA routes.
5. Starts listening on `PORT`.

The server is intentionally thin at the route-registration layer. Business logic belongs in route modules and `server/src/lib` helpers.

### Important server helpers

- `addresses.js` normalizes addresses, validates addresses, checks internal domains, and normalizes subjects.
- `deliver.js` is the central delivery seam. Both human compose and transactional sending call it.
- `mailboxes.js` provisions and finds mailboxes.
- `session.js` creates and verifies the signed session cookie.
- `oidc.js` performs OIDC discovery and token verification.
- `serviceTokens.js` hashes and validates machine-to-machine tokens.
- `templates.js` renders transactional templates.
- `workspaceAddresses.js` resolves workspace-owned addresses.
- `workspaceTemplates.js` manages workspace template data.

### Delivery flow

`POST /api/messages` validates the user payload and calls `deliverMessage()`.

`deliverMessage()`:

1. Normalizes and validates all recipients.
2. Finds the existing thread for `inReplyTo`, or creates a thread.
3. Creates one physical `messages` row.
4. Creates recipient rows.
5. Updates the thread timestamp.
6. Creates the sender's `SENT` mailbox view.
7. Creates an `INBOX` mailbox view for each internal recipient.
8. Records internal delivery in `delivery_log`.
9. Records external recipients as rejected in the current internal-only phase.
10. Returns message/thread/RFC identifiers and delivery results.

This function is the most important abstraction in the backend. Future SMTP delivery should extend the external-recipient branch and add inbound SMTP calls into this same function rather than creating a second delivery model.

### User-facing routes

- `/auth/*` - login, callback, session, logout.
- `/api/threads` - mailbox thread lists and individual thread data.
- `/api/messages` - send, drafts, message flags, folder moves, deletion, chat editing.
- `/api/labels` - user labels and applying labels.
- `/api/attachments` - upload files and issue signed download URLs.
- `/api/search` - Postgres full-text search.
- `/api/friends` - find internal T-mail users.
- `/api/tokens` - user-managed service tokens.
- `/api/business-account` - workspace/business account requests.
- `/api/workspace-addresses` - workspace custom addresses.
- `/api/workspace-templates` - workspace email templates and public templates.
- `/api/workspace-send` - workspace sending flow.

### Transactional route

`/api/system/send` is for trusted applications and TGO ID. It uses a service token, not a browser session. It supports built-in verification and security templates and calls the same delivery helper as normal mail.

## 8. Database Model

The complete schema is in `server/db/schema.sql`. Run it in the Supabase SQL editor. Later changes belong in timestamped SQL migration files under `server/db/`.

Core tables:

- `mailboxes` - one mailbox per TGO ID identity.
- `threads` - global conversation identity and last activity.
- `messages` - one physical message record, body, sender, subject, mode, RFC fields, and search vector.
- `recipients` - one row per `to`, `cc`, or `bcc` address.
- `mailbox_messages` - per-mailbox view of a physical message. This is the unit used for folders, read state, stars, and trash.
- `labels` and `message_labels` - user labels.
- `attachments` - metadata; file bytes live in private Supabase Storage.
- `delivery_log` - internal/rejected delivery status now and SMTP status later.
- `service_tokens` - hashed application tokens.
- `workspaces`, `workspace_members`, `workspace_addresses`, `workspace_templates` - workspace/business email features.

Important design rule: one physical message can have multiple mailbox views. Do not duplicate the physical message for every recipient.

The `messages.message_mode` field currently supports `mail` and `chat`. The message mode controls presentation and chat-specific editing behavior in the web app.

## 9. Web Architecture

`web/src/App.jsx` gates authenticated routes through `useAuth()`:

- `/login` - unauthenticated login screen.
- `/guide` - transactional integration guide.
- `/workspace` - workspace dashboard.
- `/*` - authenticated mailbox shell.

`Mailbox.jsx` owns mailbox-level state:

- Current folder and label.
- Thread list and selected thread.
- Search state.
- Compose state.
- Mobile navigation state.
- Periodic thread refresh.

`Mailbox.jsx` renders:

- `Sidebar` for folders, labels, compose, and account actions.
- `SearchBar` for full-text search.
- `FriendSearch` for internal recipients.
- `ThreadList` for the current folder/search result.
- `ThreadView` for the selected conversation.
- `Compose` for new mail, chat, and reply composition.

### ThreadView

`ThreadView.jsx` loads a thread every two seconds while it is open, renders message history, handles message actions, and mounts the inline reply composer.

The current conversation UI has Gmail-inspired navigation and actions:

- Back to inbox.
- Archive.
- Delete.
- Mark unread.
- Reply.
- More actions.

It still supports the app's existing chat-bubble presentation for chat-mode messages. Mail-mode messages use larger email cards with sender, recipients, timestamps, HTML/text body, and attachment chips.

### Compose

`Compose.jsx` supports:

- New mail.
- New internal chat.
- Inline replies.
- To, Cc, Bcc, subject, text, and HTML body.
- Rich editing through `contentEditable` and browser `document.execCommand` commands.
- Undo/redo, font family/size, bold, italic, underline, text color, alignment, lists, indentation, quote, strikethrough, clear formatting, links, emoji, signatures, image/file uploads, and more actions.
- Save draft.
- Full-screen mail compose page with a Back button that hides the mailbox behind it.
- Chat mode remains a modal/chat-style composer.

Attachments are uploaded before send through `/api/attachments`; the resulting metadata is included in the message send payload.

### API client

`web/src/lib/api.js` is the only normal browser API wrapper. It adds credentials, JSON headers, parses errors, and exposes typed-by-convention methods such as `threads`, `thread`, `send`, `saveDraft`, `patchMessage`, `trashMessage`, `search`, and attachment methods.

Use this wrapper for new browser requests rather than calling `fetch` directly in components, except for the existing multipart attachment upload implementation.

## 10. UI and Design Preferences

The project follows the TGO ID visual language and has been extended with Gmail-inspired mail workflows.

Current preferences:

- Monochrome white/gray surfaces with a restrained blue accent.
- Tailwind utilities and shared component classes from `web/src/index.css`.
- Compact, scan-friendly mailbox layouts rather than marketing-style cards.
- Responsive behavior for desktop and mobile.
- Familiar icon controls should use inline SVGs consistent with existing components.
- Buttons that are icon-only need `aria-label` and `title` values.
- Use existing classes such as `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-outline`, `.input`, `.textarea`, `.card`, `.panel`, `.nav-item`, and `.chip` before inventing new styling.
- Keep page-level sections unframed where possible; use cards for messages and genuinely framed tools.
- Avoid introducing another icon library without a clear project-wide decision.
- Avoid using emoji or Unicode symbols as substitute UI icons. Text characters such as `B`, `I`, and `U` are acceptable when they are the actual formatting convention.
- Keep user-facing copy concise and task-oriented.

When a new design request conflicts with the existing product architecture, preserve the app's functional behavior and adapt the visuals locally.

## 11. Current Implemented Features

### Authentication and identity

- TGO ID OIDC login with PKCE.
- Signed httpOnly session cookie.
- Automatic mailbox lookup/provisioning.
- Sign out.

### Human mail

- Inbox, Sent, Drafts, Trash, Starred, and labels.
- Threaded messages.
- Internal `@tgo.com` delivery.
- Mail and chat message modes.
- Cc and Bcc fields.
- Rich body editing.
- Attachments backed by Supabase Storage.
- Full-text search.
- Read/unread flags.
- Stars.
- Trash and permanent deletion.
- Chat message editing for the sender.
- Gmail-inspired thread navigation and compose presentation.

### Transactional and workspace features

- Service-token-authenticated system send route.
- Verification, login OTP, and security alert templates.
- User-created hashed service tokens.
- Business account/workspace request flow.
- Workspace-owned addresses.
- Workspace templates and public template gallery.
- Workspace sending flow.

## 12. Known Limitations

These are important before extending the product:

1. External email is not delivered. External recipients are returned as undeliverable/rejected.
2. Scheduled send is not implemented. There is no durable scheduled-message queue, worker, claim/lease strategy, or cancel endpoint.
3. The current service is not a background worker. `server/src/index.js` only starts Express.
4. Drafts are saved as messages, but there is no complete draft listing/editing/resume workflow documented as a separate feature.
5. The compose UI exposes read-receipt and confidential-mode controls, but the current send API does not persist or enforce those semantics.
6. The compose UI's schedule-send concept is not connected to a backend queue.
7. The thread refresh strategy is polling every two seconds; pagination and cursor-based loading are not implemented in the web UI.
8. Reactions and some message-menu actions are presentation-level only.
9. There is no comprehensive automated unit, integration, or end-to-end test suite in the current workspace.
10. Delivery is not fully transactionally idempotent across a process crash after physical delivery and before a response.
11. The `delivery_log` exists, but full outbound SMTP status handling is future work.

## 13. Remaining Work

### Highest priority: reliability and product correctness

- Add automated tests for auth guards, address normalization, delivery fan-out, folders, drafts, attachments, and thread rendering.
- Add request-level integration tests against a test database or Supabase test project.
- Add structured server logging and consistent error reporting.
- Add cursor pagination for thread lists, search, and long conversations.
- Improve draft lifecycle: list drafts, reopen a draft, update an existing draft, autosave, and delete.
- Confirm folder semantics for Archive and Spam and add explicit API support where needed.

### Scheduled send

Implement this as a durable feature, not a client-only timer:

1. Add a `scheduled_messages` table with payload, `send_at`, status, attempt count, lock/lease fields, error text, and resulting message ID.
2. Extend `POST /api/messages` or add a dedicated schedule route with a canonical UTC `sendAt` value.
3. Validate recipients and attachments before queueing.
4. Add a cancel/list/status API scoped to the user's mailbox.
5. Add a polling worker or separate worker process.
6. Claim due rows atomically with a lease or Postgres `FOR UPDATE SKIP LOCKED` function.
7. Reuse `deliverMessage()` for actual delivery.
8. Add idempotency handling so a worker crash cannot send the same message twice.
9. Add a Scheduled folder/list and clear UI states for queued, sent, failed, and canceled.

### Internet email

- Select an owned production domain.
- Configure MX, SPF, DKIM, DMARC, PTR/rDNS, and TLS.
- Choose and operate an inbound/outbound MTA.
- Add outbound queueing and retry/backoff.
- Add inbound SMTP parsing that calls `deliverMessage()`.
- Add spam filtering, abuse controls, bounce handling, and reputation monitoring.
- Replace the current external-recipient rejection branch with MTA queue insertion.

### Webmail polish

- Add a true Gmail-like message collapse/expand interaction.
- Add archive, spam, forward, and more-action behavior with explicit backend contracts.
- Add responsive desktop/mobile visual regression checks.
- Add a real color picker instead of a prompt for text color.
- Add configurable signatures instead of prompt-only insertion.
- Add image insertion into the body versus attachment-only upload.
- Add keyboard shortcuts and accessible focus management.
- Add loading, empty, retry, and offline states.

### Operational readiness

- Add health checks for Supabase connectivity and OIDC discovery.
- Add graceful shutdown for the API and future worker.
- Add database migration verification in deployment.
- Add storage bucket setup automation and attachment cleanup.
- Add rate-limit and audit dashboards.
- Add production error tracking.

## 14. Safe Extension Rules

When implementing a new task:

1. Identify whether it belongs to the server route, a `server/src/lib` business helper, the database schema/migration, or the web component.
2. Keep `deliverMessage()` as the shared delivery seam. Do not create a second user-send path.
3. Keep all Supabase service-role operations on the server.
4. Validate request bodies with Zod.
5. Scope user data queries by `req.user.mailboxId`.
6. Use a migration for database changes and update `schema.sql` when the schema baseline changes.
7. Use `api.js` for browser API calls.
8. Preserve `mail` and `chat` message-mode semantics.
9. Sanitize stored HTML before rendering with DOMPurify.
10. Use existing UI classes and inline SVG patterns.
11. Add focused validation after each edit, normally `npm run build` for web changes and a targeted server/API check for backend changes.
12. Do not add fake UI controls for behavior that has no backend contract. Mark planned behavior clearly until the backend exists.

## 15. Useful Reference Files

- [PLAN.md](PLAN.md) - original product architecture, rationale, and roadmap.
- [server/db/schema.sql](server/db/schema.sql) - database baseline.
- [server/src/index.js](server/src/index.js) - Express app and route registration.
- [server/src/lib/deliver.js](server/src/lib/deliver.js) - delivery seam.
- [server/src/routes/messages.js](server/src/routes/messages.js) - user send, draft, patch, and delete behavior.
- [web/src/App.jsx](web/src/App.jsx) - top-level route/auth gate.
- [web/src/pages/Mailbox.jsx](web/src/pages/Mailbox.jsx) - mailbox state and layout.
- [web/src/components/ThreadView.jsx](web/src/components/ThreadView.jsx) - conversation page.
- [web/src/components/Compose.jsx](web/src/components/Compose.jsx) - mail, chat, and reply composition.
- [web/src/lib/api.js](web/src/lib/api.js) - browser API wrapper.
- [web/src/index.css](web/src/index.css) - shared UI classes and visual tokens.
