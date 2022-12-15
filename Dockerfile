FROM node:16-alpine AS frontend
WORKDIR /front
COPY package.json angular.json tsconfig.json /front/
RUN npm install
COPY src /front/src
RUN npm run build:prod


FROM python:3.10-alpine
RUN apk add --update build-base
EXPOSE 8080
WORKDIR /app
COPY hypercorn.toml /app/
CMD ["hypercorn", "--config", "hypercorn.toml", "app:app"]
RUN python -m venv /venv
ENV PATH=/venv/bin:${PATH}
COPY backend-py/requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt
COPY backend-py /app/
COPY --from=frontend /front/static /app/static
VOLUME ["/app/app.db"]
USER nobody