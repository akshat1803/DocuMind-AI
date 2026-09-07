FROM node:24.18.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
# Empty means same-origin /api, forwarded by the web server below.
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace=@documind/shared && npm run build --workspace=@documind/web

FROM nginx:1.31.5-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
