# ---- Base ----
FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
# better-sqlite3 needs python3 + build tools for native compilation
RUN apt-get update && apt-get install -y python3 make g++ openssl && rm -rf /var/lib/apt/lists/*
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the Next.js standalone output
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Generate throwaway secrets for the build step (Next.js validates env at build time)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN ENCRYPTION_KEY="$(openssl rand -base64 32)" SESSION_SECRET="$(openssl rand -base64 32)" pnpm build

# ---- Production ----
FROM node:22-slim AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3030
ENV HOSTNAME=0.0.0.0

# Copy the standalone output (includes server.js + required node_modules)
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Copy content (augmentation markdown files) and drizzle migrations
COPY --from=build /app/content ./content
COPY --from=build /app/drizzle ./drizzle

# Copy js-yaml (needed by the entrypoint seed step)
COPY --from=build /app/node_modules/js-yaml ./node_modules/js-yaml

# Create data directory for SQLite (mount as a volume for persistence)
RUN mkdir -p /app/data

# Copy the entrypoint script (handles migrations + seed on every start)
COPY --from=build /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3030

ENTRYPOINT ["./docker-entrypoint.sh"]
