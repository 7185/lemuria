# Lemuria

[![build](https://img.shields.io/github/actions/workflow/status/7185/lemuria/lemuria.yml?style=flat-square)](https://github.com/7185/lemuria/actions)
[![license](https://img.shields.io/github/license/7185/lemuria.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![last-commit](https://img.shields.io/github/last-commit/7185/lemuria?display_timestamp=author&style=flat-square)](https://github.com/7185/lemuria/commits/master)
[![CodeFactor](https://www.codefactor.io/repository/github/7185/lemuria/badge)](https://www.codefactor.io/repository/github/7185/lemuria) \
![nestjs](https://img.shields.io/github/package-json/dependency-version/7185/lemuria/@nestjs/core?filename=backend%2Fpackage.json&label=nestjs&style=flat-square&logo=nestjs&color=%23E0234E)
![angular](https://img.shields.io/github/package-json/dependency-version/7185/lemuria/@angular/core?filename=frontend%2Fpackage.json&label=angular&style=flat-square&logo=angular&color=%230F0F11)
![three](https://img.shields.io/github/package-json/dependency-version/7185/lemuria/three?filename=frontend%2Fpackage.json&style=flat-square&logo=three.js&color=%23000000)

Yet another project about creating a 3D virtual world and stuff.

<p align="center">
<img src="frontend/src/app/logo/logo.component.svg" alt="Lemuria" width="256"/>
</p>

Powered with Nest (or Quart), Angular and Three.js.

## Installation

First we need to fetch all dependencies:

```bash
$ npm ci
```

Then we build the frontend:

```bash
# You can also use build:prod to build a production-ready bundle
$ npm run build -w frontend
```

## First DB and server setup

Here you will find a few steps to follow in order to create and populate a working database for Lemuria.

### Install various dependencies for the server

There are two different implementations for the backend server: Node and Python.

#### Node backend
```bash
$ npx -w backend prisma generate --generator client
```

#### Python backend
```bash
$ python -m venv venv
$ source venv/bin/activate
$ pip install -r backend-py/requirements.txt
$ prisma generate --schema backend/prisma/schema.prisma --generator client-py
```
### Create an empty database and import the dump files

#### Node backend
```bash
$ npx -w backend prisma db push --skip-generate
```
There is no node script to import worlds yet, so you can use the python one instead.

#### Python backend
```bash
# See above for the venv setup
$ prisma db push --schema backend/prisma/schema.prisma
$ cd backend-py
$ python tools/import_lemuria.py
```

This will create and init the database `backend/app.db` using the data in `dumps/atlemuria.txt` and `dumps/proplemuria.txt`.

### Serve the world files

Once again, you can choose between node or python to serve the world resource files. To avoid CORS issues when accessing static files from a web browser, do the following:

#### Node file server
```bash
$ npx -y http-server -p 8181 -c-1 --cors
```

#### Python file server
```bash
$ cd backend-py
$ python tools/serve_path.py
```

This will run a script to serve files in the current directory on port `8181`.
You will also need the `village2` resource path to be served, to do so you can create a symlink by running the following (but set the path correctly first):

```bash
$ ln -s /my/path/to/resource/directory/for/village2 village2
```

### Run the server

The API backend is listening on port `8080`.

#### Node backend

```bash
$ npm -w backend run start
```

#### Python backend

```bash
$ prisma generate --schema backend/prisma/schema.prisma --generator client-py # only needed if the prisma version or the schema changed
$ cd backend-py
$ python app.py
```

## Docker

You can also generate a docker image to build the project and run the server in a container:

```bash
# Build with the node backend
$ docker build --target node -t lemuria .
# OR with the python backend
$ docker build --target python -t lemuria .

$ docker run -it -p 8080:8080 -v $PWD/backend-py/app.db:/backend/app.db -v $PWD/dumps:/backend/dumps lemuria
```

## Bot

You can use node or python bots on Lemuria. See the `bot` and `bot-py` directories.
```ts
// typescript
import {Bot} from './bot'
```
```python
# python
from bot import Bot
```

An example bot `bonobot.ts`/`bonobot.py` is available in this repository.

## Try it out!

Once `npm run start` (or `app.py`) and `http-server` (or `serve_path.py`) are running: open your favorite web browser and go to `http://localhost:8080`,
you should be prompted with a login screen, put whatever nickname you want, the password you provide doesn't matter as
there's no proper authentication for the moment.
