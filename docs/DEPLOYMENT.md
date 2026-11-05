# Chaty on a VPS

The production compose stack runs PostgreSQL on a private Docker network, the authenticated API with a persistent private file volume, and Caddy as the only Internet-facing service. Caddy provides TLS and reverse-proxies both REST and Socket.IO traffic.

## Prerequisites

- A Linux VPS with Docker Engine and the Docker Compose plugin.
- A hostname resolving to the VPS public IP. If you do not own a domain, a hostname such as `chaty.<VPS-IP>.nip.io` can resolve to the embedded IP; replace `<VPS-IP>` with the dotted IPv4 address. A trusted HTTPS certificate is required for friends' computers.
- Inbound TCP ports 80 and 443 allowed in the VPS firewall/provider firewall.

## Deploy

1. Copy the project to the VPS and enter its root folder.
2. Copy `deploy/.env.example` to `deploy/.env`. Set `CHATY_DOMAIN` to your hostname and replace both secrets with random values. Keep this file private.
3. Run `docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d --build`.
4. Check `docker compose --env-file deploy/.env -f deploy/docker-compose.yml ps` and `curl https://YOUR_DOMAIN/health`.
5. On the development computer, copy `apps/desktop/.env.production.example` to `apps/desktop/.env.production`, set the same `https://YOUR_DOMAIN` address, then run `npm run package:windows`.
6. Share the generated `apps/desktop/release/Chaty Setup 0.1.0.exe` with friends. Everyone registers an account in the same Chaty server.

The production API runs `prisma migrate deploy` before startup. Do not expose port 3001 or PostgreSQL publicly; Caddy is the only published ingress. Back up the database and the `chaty-files` Docker volume. The current disk storage has no malware scanner, retention policy, or object-store replication, so it is an early private beta deployment recipe rather than a hardened public service.

To update, pull the reviewed project changes, rebuild/recreate the stack, and keep the persistent volumes. Back up before schema changes. Do not delete volumes when stopping the service.
