# Initial API

Base URL in local development: `http://localhost:3001`.

## Authentication

- `POST /api/auth/register` — `{ username, displayName, email, password }`
- `POST /api/auth/login` — `{ email, password }`
- `GET /api/auth/me` — authenticated account details
- `POST /api/auth/logout` — authenticated presence update
- `GET /api/users/search?q=...` — authenticated user search

Registration and login return a 15-minute bearer access token. The desktop client holds it in memory and asks users to sign in again after restart or expiry. Refresh-token rotation and revocation are not implemented yet.

## Conversations and messages

- `GET /api/conversations` — list the signed-in user's conversations
- `POST /api/conversations` — `{ userId }` to create or retrieve a private conversation
- `GET /api/conversations/:id/messages?before=<message-id>&limit=40` — paginated history
- `POST /api/conversations/:id/messages` — `{ content, clientMessageId }`
- `POST /api/conversations/:id/files` — multipart form field `file` (25 MB maximum)
- `GET /api/files/:id/download` — authorized download; add `?preview=true` only for supported PDF and image previews

Protected requests use `Authorization: Bearer <access-token>`. Socket.IO uses `auth: { token }` during connection and supports `message:send` with `{ conversationId, content, clientMessageId }`; accepted messages are persisted before acknowledgement and broadcast as `message:new` to conversation members.

Every conversation read and write checks membership server-side. Uploaded files are saved to the private server `.data/files` directory for local development. The server sniffs PDF and common image signatures; unsupported types are delivered as downloads with `application/octet-stream`. This local storage is not a substitute for malware scanning and private object storage in production.
