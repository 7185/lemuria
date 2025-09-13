FROM node:22-slim AS frontend
WORKDIR /root
COPY action-parser/package.json action-parser/tsconfig.json /root/action-parser/
COPY frontend/package.json frontend/angular.json frontend/tsconfig*.json frontend/transloco.config.ts /root/frontend/
COPY frontend/public /root/frontend/public
COPY action-parser/src /root/action-parser/src
COPY frontend/src /root/frontend/src
COPY patches /root/patches
COPY package.json package-lock.json /root/
RUN npm -w action-parser -w frontend ci --include-workspace-root && \
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
RUN apk add --update --no-cache icu-libs openssl && \
    python -m venv /venv && \
    pip install --no-cache-dir -r /backend/requirements.txt && \
    prisma generate --schema /backend/prisma/schema.prisma --generator client-py && \
    rm -r /root/.cache/prisma /root/.cache/prisma-python/nodeenv /root/.npm && \
    chown nobody: -R /root /backend
CMD ["hypercorn", "--config", "hypercorn.toml", "app:app"]
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD ["python", "-c", "import sys,urllib.request; sys.exit(0) if urllib.request.urlopen('http://localhost:8000/readyz').status==200 else sys.exit(1)"]
VOLUME ["/app.db"]
USER nobody

FROM node:22-slim AS node
EXPOSE 8080
ENV NODE_PATH="/root/node_modules"
ENV DATABASE_URL="file:/app.db"
ENV ADAPTER_URL="file:/app.db"
WORKDIR /root
COPY backend /root/backend/
COPY --from=frontend --chown=nobody:nobody /root/static /static
COPY package.json package-lock.json /root/
RUN npm -w backend ci --include-workspace-root && \
    npm -w backend run build && \
    mv backend/dist / && \
    npm -w backend prune --omit=dev && \
    npx -y nm-prune --force && \
    rm package*json && \
    rm -r .cache .npm backend && \
    chown nobody: -R /root /dist /static
CMD ["node", "/dist/main"]
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:8080/readyz').then(x=>x.status==200?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"]
VOLUME ["/app.db"]
USER nobody

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS node-distroless
EXPOSE 8080
COPY --from=node --chown=nonroot:nonroot /root/node_modules /node_modules
COPY --from=node --chown=nonroot:nonroot /dist /dist
COPY --from=node --chown=nonroot:nonroot /static /static
ENV DATABASE_URL="file:/app.db"
ENV ADAPTER_URL="file:/app.db"
WORKDIR /dist
CMD ["main.js"]
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://localhost:8080/readyz').then(x=>x.status==200?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"]
VOLUME ["/app.db"]
USER nonroot
