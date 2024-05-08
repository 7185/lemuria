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


FROM python:3.12-alpine AS python
EXPOSE 8080
WORKDIR /backend
ENV PATH="/venv/bin:$PATH"
COPY backend-py /backend/
COPY backend/prisma/schema.prisma /backend/prisma/schema.prisma
COPY --from=frontend --chown=nobody:nobody /static /backend/static
RUN apk add --update --no-cache icu-libs && \
    python -m venv /venv && \
    pip install --no-cache-dir -r /backend/requirements.txt && \
    prisma generate --schema /backend/prisma/schema.prisma --generator client-py && \
    chown nobody -R /root && \
    rm /backend/.env
COPY backend/.env /backend/.env
CMD ["hypercorn", "--config", "hypercorn.toml", "app:app"]
VOLUME ["/backend/app.db", "/backend/dumps"]
USER nobody

FROM node:20-alpine AS node
EXPOSE 8080
WORKDIR /
COPY backend /backend/
COPY --from=frontend --chown=nobody:nobody /static /backend/static
COPY package.json package-lock.json /
RUN npm -w backend ci && \
    npx -w backend prisma generate --generator client && \
    npm -w backend run build && \
    cp -r backend/dist/ /dist/ && \
    rm -rf /node-modules /backend/src /backend/test
CMD ["node", "/dist/main"]
VOLUME ["/backend/app.db", "/backend/dumps"]
USER nobody
