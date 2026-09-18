# Priority Gold — admin

## Where

Admin → **Features** (`/features`).

Only signed-in admins can change availability. The first registered user is already an admin; that path is unchanged.

## Flag

```text
priorityGoldTheme: true | false
```

Stored in MongoDB collection `settings`, document `key: "features"`.

Default if missing: **enabled** (`true`).

## APIs

### `GET /api/features`

Public (Telegram Air client). CORS `*`.

```json
{ "priorityGoldTheme": true }
```

### `POST` / `PATCH` `/api/features`

Requires admin session (`requireApiAdmin` → JWT cookie). Role is not taken from the client body.

```json
{ "priorityGoldTheme": false }
```

Disabling shows a confirmation in the admin UI: users on Priority Gold fall back to the default Telegram theme on the next flag refresh.

## What this is not

- Not NestJS `/api/v1/admin/features`
- Not Redis `feature:priorityGoldTheme`
- Not a WebSocket `feature.updated` event

Those pieces do not exist in this repo. Polling + cache is the live update path.
