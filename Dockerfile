FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Use npmmirror for better connectivity in China
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry https://registry.npmmirror.com && \
    corepack enable && \
    corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/webgl-image/package.json ./packages/webgl-image/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /usr/src/app
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=deps /usr/src/app/packages/webgl-image/node_modules ./packages/webgl-image/node_modules
COPY . .
RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm run build:deps
RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm run build

FROM node:22-alpine AS runtime
WORKDIR /app

COPY --from=build /usr/src/app/.output ./.output
COPY --from=build /usr/src/app/packages/webgl-image/dist ./packages/webgl-image/dist
COPY --from=build /usr/src/app/scripts ./scripts
COPY --from=build /usr/src/app/server/database/migrations ./server/database/migrations

# Install dependencies:
# 1. perl: required for exiftool-vendored runtime
# 2. python3, make, g++: required for building native modules (better-sqlite3)
# Clean up build tools and cache in the same layer to reduce image size
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories && \
    apk update && \
    apk add --no-cache perl python3 make g++ && \
    npm config set registry https://registry.npmmirror.com && \
    # Install dependencies for sharp (linux-x64) and better-sqlite3
    npm install drizzle-orm@^0.44.4 better-sqlite3@^12.2.0 sharp@0.34.4 exiftool-vendored@^30.3.0 && \
    # Rebuild sharp if necessary (sometimes needed for alpine)
    # npm rebuild sharp && \
    npm cache clean --force && \
    apk del python3 make g++

EXPOSE 3000
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV NITRO_PORT=3000
ENV NITRO_HOST=0.0.0.0

# node scripts/migrate.mjs first
CMD ["sh", "-c", "node scripts/migrate.mjs && node .output/server/index.mjs"]
