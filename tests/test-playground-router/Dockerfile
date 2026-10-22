# Build from the repository root: docker build -f tests/test-playground-router/Dockerfile .
FROM node:24.22.1-bookworm-slim AS workspace
COPY --from=oven/bun:1.4.4 /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx
ENV HUSKY=0 TURBO_TELEMETRY_DISABLED=1
WORKDIR /app
COPY . .

FROM workspace AS development-dependencies
RUN bun install --frozen-lockfile

FROM development-dependencies AS build
# Keep the common package-build layer reusable between both playground images.
RUN bunx turbo run build --filter='./packages/*' --concurrency=1
RUN bunx turbo run build --filter=test-playground-router --concurrency=1
RUN mkdir -p /runtime \
    && cp -a --parents tests/test-playground-router/build /runtime \
    && find packages -mindepth 2 -maxdepth 2 -type d -name dist -exec cp -a --parents {} /runtime \;

FROM workspace AS production-dependencies
RUN bun install --frozen-lockfile --production --ignore-scripts

FROM node:24.22.1-bookworm-slim
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
# Preserve workspace links and any workspace-local production dependencies.
COPY --from=production-dependencies /app /app
COPY --from=build /runtime/ /app/
WORKDIR /app/tests/test-playground-router
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
