FROM node:22.17.0-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/attendance-engine/package.json packages/attendance-engine/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile
COPY apps ./apps
COPY packages ./packages
COPY prisma ./prisma
RUN pnpm exec prisma generate --schema prisma/schema.prisma \
  && pnpm --filter @tinh-cong/attendance-engine build \
  && pnpm --filter @tinh-cong/api build

FROM node:22.17.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY --from=build /app /app
EXPOSE 3000
CMD ["sh", "-c", "pnpm exec prisma migrate deploy --schema prisma/schema.prisma && node apps/api/dist/main.js"]
