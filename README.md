# Lemuria

[![Lemuria CI](https://github.com/7185/lemuria/actions/workflows/lemuria.yml/badge.svg)](https://github.com/7185/lemuria/actions/workflows/lemuria.yml)

Yet another project about creating a 3D virtual world and stuff.

Powered with Nest (or Quart), Angular and Three.js.

## Installation

First we need to fetch all dependencies for the frontend, go to `frontend` and do the following:

```bash
$ npm ci
```

Then we build and run the project:

```bash
# You can also use build:prod to build a production-ready bundle
$ npm run build
```

To avoid CORS issues when accessing static files from a web browser, go to `backend-py` and do the following:

```bash
$ python tools/serve_path.py
```

This will run a script to serve files in `backend-py` on port `8181`

## First DB and server setup

Here you will find a few steps to follow in order to create and populate a working database for Lemuria.

### Install various dependencies for the server

There are two different implementations for the backend server.

#### Node backend
```bash
$ cd backend
$ npm ci
```

#### Python backend
```bash
$ pip3 install --user -r backend-py/requirements.txt
```
### Create an empty database and import the dump files

Go into `backend-py/tools`, then run the following:

```bash
$ python import_lemuria.py
```

This will create and init the database `backend-py/app.db` using the data in `backend-py/dumps/atlemuria.txt` and `backend-py/dumps/proplemuria.txt`.

You will also need the `village2` resource path to be served, to do so you can go to `backend-py`
and create a symlink by running the following (but set the path correctly first):

```bash
$ ln -s /my/path/to/resource/folder/for/village2 village2
```

### Run the server

The API backend is listening on port `8080`.

#### Node backend
Go to `backend` and run the following:

```bash
$ npm run start
```

#### Python backend
Go to `backend-py` and run the following:

```bash
$ python3 app.py
```

## Docker

You can also generate a docker image to build the project and run the server in a container:

```bash
# Build with the node backend
$ docker build --target backend -t lemuria .
# OR with the python backend
$ docker build --target backend-py -t lemuria .

$ docker run -it -p 8080:8080 -v $PWD/backend-py/app.db:/app/app.db -v $PWD/dumps:/app/dumps lemuria
```

## Try it out!

Once `npm run build`, `npm run start` (or `app.py`) and `serve_path.py` are running: open your favorite web browser and go to `http://localhost:8080`,
you should be prompted with a login screen, put whatever nickname you want, the password you provide doesn't matter as
there's no proper authentication for the moment.
