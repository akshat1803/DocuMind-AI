FROM node:24.18.0-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --no-audit --no-fund
COPY tsconfig.json prisma.config.ts ./
COPY prisma prisma
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN DATABASE_URL=postgresql://unused:unused@localhost:5432/build node node_modules/prisma/build/index.js generate
RUN npm run build --workspace=@documind/shared && npm run build --workspace=@documind/api

# Run once before the API starts; migration tooling stays out of the API image.
FROM build AS migrate
USER node
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM build AS production-dependencies
RUN npm prune --omit=dev --no-audit --no-fund

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
