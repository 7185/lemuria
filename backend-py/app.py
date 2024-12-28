#!/usr/bin/env python
"""App module"""

import quart_flask_patch
import asyncio
import tomllib

from quart import Quart, render_template, websocket, request, send_from_directory
from quart_jwt_extended import JWTManager, decode_token
from flask_caching import Cache
from proxy.api import api_proxy
from user.api import api_auth
from user.model import authorized_users
from world.api import api_world
from utils.ws import sending, receiving
from utils.orjson import OrJSONProvider

with open('config.toml', 'rb') as config_file:
    toml_data = tomllib.load(config_file)

app = Quart(__name__)
app.config.from_mapping(toml_data)
config = app.config

app.static_folder = config['STATIC_PATH']
app.template_folder = config['STATIC_PATH']
app.secret_key = config['SECRET_KEY']

jwt = JWTManager(app)
app.cache = Cache(app)
app.json = OrJSONProvider(app)

@app.route('/')
async def index():
    """Default route"""
    return await render_template("index.html")

@app.route('/<path:path>')
async def static_path(path):
    """Static files"""
    return await send_from_directory(config['STATIC_PATH'], path)

@app.websocket('/api/v1/ws')
async def wsocket():
    """Websocket"""
    token = websocket.cookies.get(config['JWT_ACCESS_COOKIE_NAME'])

    if token is None:
        await websocket.close(code=400, reason='Missing JWT')
        return
    try:
        data = decode_token(token)
    except Exception as dummy:
        await websocket.close(code=401, reason='Invalid JWT')
        return

    user = next((user for user in authorized_users if user.auth_id == data['identity']), None)
    if user is None:
        return
    user.websockets.add(websocket._get_current_object())
    user.connected = True
    await user.set_timer()
    producer = asyncio.create_task(sending(user))
    consumer = asyncio.create_task(receiving(user))
    await asyncio.gather(producer, consumer)

@app.errorhandler(404)
async def redirect(_):
    """Redirect everything to index"""
    if '/api/' in request.url:
        return {'error': 'Not found'}, 404
    return await render_template("index.html")

app.register_blueprint(api_auth)
app.register_blueprint(api_world)
app.register_blueprint(api_proxy)

if __name__ == "__main__":
    app.run(host='localhost', port=8080)
