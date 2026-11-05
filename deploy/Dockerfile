FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/desktop/package.json ./apps/desktop/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci

COPY apps/server ./apps/server
COPY packages/shared ./packages/shared
RUN npm --workspace apps/server run db:generate
RUN npm --workspace apps/server run build

ENV NODE_ENV=production
ENV PORT=3001
ENV FILE_STORAGE_DIR=/data/files
VOLUME ["/data/files"]
EXPOSE 3001
CMD ["npm", "--workspace", "apps/server", "run", "start"]
