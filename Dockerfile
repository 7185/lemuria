FROM node:20-alpine AS frontend
WORKDIR /front
COPY frontend/package.json frontend/package-lock.json frontend/angular.json frontend/tsconfig.json /front/
RUN npm ci
COPY frontend/src /front/src
RUN npm run build:prod


FROM python:3.12-alpine AS backend-py
RUN apk add --update --no-cache build-base
EXPOSE 8080
WORKDIR /app
COPY hypercorn.toml /app/
CMD ["hypercorn", "--config", "hypercorn.toml", "app:app"]
RUN python -m venv /venv
ENV PATH=/venv/bin:${PATH}
COPY backend-py/requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt && \
    prisma generate --schema ../backend/prisma/schema.prisma --generator client-py
COPY backend-py /app/
COPY --from=frontend /static /app/static
VOLUME ["/app/app.db", "/app/dumps"]
USER nobody

FROM node:20-alpine AS backend
RUN apk add --update --no-cache build-base
EXPOSE 8080
WORKDIR /app
CMD ["node", "dist/main"]
COPY backend/package.json backend/package-lock.json /app/
RUN npm ci
COPY backend /app/
RUN npx prisma generate --generator client && \
    npm run build
COPY --from=frontend --chown=nobody:nobody /static /app/static
VOLUME ["/app/app.db", "/app/dumps"]
USER nobody