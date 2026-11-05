FROM node:22-bookworm-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 user
WORKDIR /app

COPY package*.json ./
COPY apps/desktop/package*.json ./apps/desktop/
COPY apps/server/package*.json ./apps/server/
COPY packages/shared/package*.json ./packages/shared/

RUN npm ci

COPY packages/shared ./packages/shared
RUN npm --workspace packages/shared run build

COPY apps/server ./apps/server
RUN npm --workspace apps/server run db:generate
RUN npm --workspace apps/server run build

RUN mkdir -p /app/data/files && chown -R user:user /app

USER user

ENV NODE_ENV=production
ENV PORT=7860
ENV FILE_STORAGE_DIR=/app/data/files

EXPOSE 7860

CMD ["npm", "--workspace", "apps/server", "run", "start:app"]
