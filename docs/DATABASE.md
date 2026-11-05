# Database

The initial Prisma schema is in `apps/server/prisma/schema.prisma`. It includes users, private/group conversations, memberships, messages, attachments, message receipts, contacts, and hashed refresh-token records. UUID identifiers and PostgreSQL timestamp-with-time-zone columns are used; conversation membership and message history have lookup indexes.

For local development, create a PostgreSQL database named `chaty`, copy `apps/server/.env.example` to `apps/server/.env`, set `DATABASE_URL`, and run `npm --workspace apps/server run db:push`. `db:push` is for local prototyping. Production startup applies the checked-in initial migration with `prisma migrate deploy`. Back up the database and test restore procedures before inviting users.
