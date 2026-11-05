# Chaty architecture

Chaty uses an Electron main process for the Windows shell and a React renderer for the interface. The renderer runs without Node.js integration; `electron/preload.ts` exposes only app information and window controls. The API is a separate Express process with Socket.IO and a PostgreSQL database accessed through Prisma.

```text
Electron main + preload
        │ narrow IPC
React renderer ───── HTTPS / WSS ───── Express + Socket.IO ───── PostgreSQL
```

The desktop renderer signs in to the API, loads private conversations, pages message history, sends text messages, and uploads/downloads private attachments. A Socket.IO connection receives new messages and reconnects automatically. Development attachments are stored in a local private server directory. Server endpoints have not been deployed or security-reviewed.

## Delivery milestones

1. Desktop shell and navigable messenger preview — implemented.
2. Initial server schema, account registration/login, private conversations, history, live text messaging, and file upload/download — implemented for local testing.
3. Rotating refresh sessions, group chat, delivery/read receipts, durable migration workflow, and malware scanning — pending.
4. Replace the local private file directory with private S3-compatible storage and deploy the server over HTTPS/WSS — pending.
5. Production security review, backups, monitoring, and signed Windows release — pending.
