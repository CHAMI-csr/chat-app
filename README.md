# Chaty Messenger

Chaty is a Windows desktop messenger built with Electron, React, TypeScript, an Express/Socket.IO server, and PostgreSQL.

## Project layout

- `apps/desktop` — Electron shell and React client
- `apps/server` — API and real-time server
- `packages/shared` — shared request and event types
- `database` — database notes and setup

## Getting started

Requirements: Node.js 20+, npm, and Docker Desktop (or a local PostgreSQL 15+ server).

1. Install dependencies with `npm install`.
2. Copy `apps/server/.env.example` to `apps/server/.env`; set `JWT_SECRET` to a random secret of at least 32 characters. For PowerShell, generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste the output into the file.
3. Start PostgreSQL with `npm run db:up` (Docker Desktop must be running).
4. Generate the Prisma client and create the local schema with `npm run db:generate` and `npm run db:push`.
5. Start the API and desktop app with `npm run dev`.

For just the desktop UI without an API, use `npm run dev:desktop`; the sign-in screen will explain that the server is unreachable.

For two computers on the same network, run the database and API on one computer, allow inbound TCP port 3001 on its firewall, and set `VITE_API_URL=http://<server-lan-ip>:3001` in `apps/desktop/.env` on each desktop before running or packaging the app. Both people must register separate accounts on that same server. For Internet access, deploy the API behind HTTPS/WSS and point the clients to that secure address.

The desktop app signs into the configured server. It supports account registration/login, user search, private conversations, persistent message history, and real-time text messages. Keep both users connected to the same reachable API server to exchange messages.

Private file uploads and member-authorized downloads work with a 25 MB limit and embedded PDF/image previews. Development files are stored in `apps/server/.data/files`. The VPS deployment recipe is in `docs/DEPLOYMENT.md`; it is an early beta setup and still needs additional production security work before handling sensitive conversations.

## Security

The Electron renderer has no Node.js access. The preload exposes a small allowlisted API, and server secrets belong only in server environment variables. The API uses Argon2id password hashing, short-lived access tokens, input validation, rate limiting on authentication, and conversation membership checks. It is an early implementation: access tokens expire after 15 minutes and there is no refresh flow; messages are not end-to-end encrypted; uploads need malware scanning; and service monitoring and tested backups are not included.
