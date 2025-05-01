FROM node:22-alpine AS frontend
WORKDIR /root
COPY action-parser/package.json action-parser/tsconfig.json /root/action-parser/
COPY frontend/package.json frontend/angular.json frontend/tsconfig*.json frontend/transloco.config.ts /root/frontend/
COPY frontend/public /root/frontend/public
COPY action-parser/src /root/action-parser/src
COPY frontend/src /root/frontend/src
COPY patches /root/patches
COPY package.json package-lock.json /root/
RUN npm -w action-parser -w frontend ci && \
    npm -w frontend run build:prod && \
    rm -r .npm action-parser frontend patches node_modules


FROM python:3.13-alpine AS python
EXPOSE 8080
WORKDIR /backend
ENV PATH="/venv/bin:$PATH"
ENV DATABASE_URL="file:/app.db"
ENV PRISMA_PY_DEBUG_GENERATOR="1"
COPY backend-py /backend/
COPY backend/prisma/schema.prisma /backend/prisma/schema.prisma
COPY --from=frontend --chown=nobody:nobody /root/static /backend/static
RUN apk add --update --no-cache icu-libs && \
    python -m venv /venv && \
    pip install --no-cache-dir -r /backend/requirements.txt && \
    prisma generate --schema /backend/prisma/schema.prisma --generator client-py && \
    rm -r /root/.cache/prisma /root/.cache/prisma-python/nodeenv /root/.npm && \
    chown nobody: -R /root /backend
CMD ["hypercorn", "--config", "hypercorn.toml", "app:app"]
VOLUME ["/app.db"]
USER nobody

FROM node:22-alpine AS node
EXPOSE 8080
ENV NODE_PATH="/root/node_modules"
ENV DATABASE_URL="file:/app.db"
WORKDIR /root
COPY backend /root/backend/
COPY --from=frontend --chown=nobody:nobody /root/static /static
COPY package.json package-lock.json /root/
RUN npm -w backend ci && \
    npm -w backend run build && \
    mv backend/src/generated/prisma/libquery_engine* backend/dist/generated/prisma/ && \
    mv backend/dist / && \
    npm -w backend prune --omit=dev && \
    npx -y nm-prune --force && \
    rm package*json && \
    rm -r .cache .npm backend && \
    chown nobody: -R /root /dist /static
CMD ["node", "/dist/main"]
VOLUME ["/app.db"]
USER nobody
