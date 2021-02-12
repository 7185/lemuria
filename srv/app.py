#!/usr/bin/env python
from quart import Quart, render_template
from functools import wraps
from ws import ws_loop

app = Quart(__name__, static_folder="static", template_folder="static")


@app.route("/")
async def index():
    return await render_template("index.html")

@app.websocket('/ws')
async def wsocket():
    await ws_loop()

@app.errorhandler(404)
async def redirect(e):
    return await render_template("index.html")

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8080)
