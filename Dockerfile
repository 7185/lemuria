FROM node:20-alpine AS frontend
WORKDIR /
COPY action-parser/package.json action-parser/tsconfig.json /action-parser/
COPY frontend/package.json frontend/angular.json frontend/tsconfig.json /frontend/
COPY action-parser/src /action-parser/src
COPY frontend/src /frontend/src
COPY package.json package-lock.json /
RUN npm -w action-parser -w frontend ci && \
    npm -w frontend run build:prod && \
    rm -rf action-parser frontend/node-modules


FROM python:3.12-alpine AS backend-py
EXPOSE 8080
WORKDIR /backend
COPY hypercorn.toml /backend/
CMD ["hypercorn", "--config", "hypercorn.toml", "app:app"]
ENV PATH="/venv/bin:$PATH"
COPY backend-py /backend/
COPY backend/prisma/schema.prisma /backend/prisma/schema.prisma
COPY --from=frontend --chown=nobody:nobody /static /backend/static
RUN apk add --update --no-cache build-base && \
    python -m venv /venv && \
    pip install --no-cache-dir -r /backend/requirements.txt && \
    prisma generate --schema /backend/prisma/schema.prisma --generator client-py
VOLUME ["/backend/app.db", "/backend/dumps"]
USER nobody

FROM node:20-alpine AS backend
EXPOSE 8080
WORKDIR /
COPY backend /backend/
COPY --from=frontend --chown=nobody:nobody /static /backend/static
COPY package.json package-lock.json /
RUN apk add --update --no-cache build-base && \
    npm -w backend ci && \
    npx -w backend prisma generate --generator client && \
    npm -w backend run build && \
    rm -rf /node-modules
CMD ["node", "backend/dist/main"]
VOLUME ["/backend/app.db", "/backend/dumps"]
USER nobody
