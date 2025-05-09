# Lemuria

<p align="center">
<img src="frontend/src/app/logo/logo.component.svg" alt="Lemuria Logo" width="256"/>
</p>
<p align="center">
<em>Yet another project about creating a 3D virtual world and stuff.<br>
Powered with Nest (or Quart), Angular and Three.js.</em>
</p>

![GitHub Repo stars](https://img.shields.io/github/stars/7185/lemuria?style=flat-square&logo=github&logoColor=181717&color=DAAA3F)
[![build](https://img.shields.io/github/actions/workflow/status/7185/lemuria/lemuria.yml?style=flat-square&logo=github-actions&logoColor=2088FF)](https://github.com/7185/lemuria/actions)
[![license](https://img.shields.io/github/license/7185/lemuria.svg?style=flat-square&logo=open-source-initiative)](https://opensource.org/licenses/MIT)
[![last-commit](https://img.shields.io/github/last-commit/7185/lemuria?display_timestamp=author&style=flat-square&logo=git)](https://github.com/7185/lemuria/commits/master)
[![CodeFactor Grade](https://img.shields.io/codefactor/grade/github/7185/lemuria?style=flat-square&logo=codefactor)](https://www.codefactor.io/repository/github/7185/lemuria) \
![node](https://img.shields.io/github/package-json/dependency-version/7185/lemuria/dev/%40types%2Fnode?filename=backend%2Fpackage.json&style=flat-square&logo=node.js&label=node&color=5FA04E)
![nestjs](https://img.shields.io/github/package-json/dependency-version/7185/lemuria/@nestjs/core?filename=backend%2Fpackage.json&label=nestjs&style=flat-square&logo=nestjs&logoColor=E0234E&color=E0234E)
![angular](https://img.shields.io/github/package-json/dependency-version/7185/lemuria/@angular/core?filename=frontend%2Fpackage.json&label=angular&style=flat-square&logo=angular&logoColor=0F0F11&color=0F0F11)
![three](https://img.shields.io/github/package-json/dependency-version/7185/lemuria/three?filename=frontend%2Fpackage.json&style=flat-square&logo=three.js&logoColor=000000&color=000000)

---

## Demo

[See Demo Here](https://lemuria.7185.fr)

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

### Install dependencies for the server

> [!NOTE]
> There are two different implementations for the backend server: Node or Python.

#### Node backend
Nothing more is needed after `npm ci` postinstall.

#### Python backend
```bash
$ python -m venv venv
$ source venv/bin/activate
$ pip install -r backend-py/requirements.txt
$ prisma generate --schema backend/prisma/schema.prisma --generator client-py
```
### Create an empty database and import the dump files

> [!CAUTION]
> If the database already exists, the world data will be overwritten.
> 
#### Node backend
```bash
$ npx -w backend prisma db push --skip-generate
$ cd backend
$ node --import 'data:text/javascript,import {register} from "node:module"; import {pathToFileURL} from "node:url"; register("ts-node/esm", pathToFileURL("./"));' src/tools/import-lemuria.mts 
```

#### Python backend
```bash
# See above for the venv setup
$ prisma db push --schema backend/prisma/schema.prisma
$ cd backend-py
$ python tools/import_lemuria.py
```

This will create and init the database `backend/app.db` using the data in `dumps/atlemuria.txt` and `dumps/proplemuria.txt`.

### Serve the world resource files

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

By default, the API backend is listening on port `8080`.

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

$ docker run -it -p 8080:8080 -v $PWD/backend/app.db:/app.db lemuria
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

> [!TIP]
> An example bot `bonobot.ts`/`bonobot.py` is available in this repository.

## Usage

Once `npm run start` (or `app.py`) and `http-server` (or `serve_path.py`) are running: open your favorite web browser and go to `http://localhost:8080`,
you should be prompted with a login screen. Put whatever nickname you want, the password you provide doesn't matter as
there's no proper authentication for the moment.

## Disclaimer

The main aim of this project is to access worlds of Active Worlds in a web browser, using dump files and paths to resource objects. Compatibility is essentially based on browser version 3.6. \
This project does not use any code from AW or its SDK. \
**This project is NOT associated with Active Worlds or ActiveWorlds, Inc.**

> [!CAUTION]
> We cannot be held responsible for any loss of data that may occur while using Lemuria. This includes world data, user data and any other information managed by the application. We strongly recommend that you make regular backups of your files and database.