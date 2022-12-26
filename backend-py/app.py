#!/usr/bin/env python
"""App module"""

import asyncio
import toml
from quart import Quart, render_template, websocket, request, jsonify
from quart_jwt_extended import JWTManager, jwt_required, decode_token
from databases import Database
from api import api_auth, api_world
from ws import sending, receiving
from user import User, authorized_users

with open('config.toml') as config_file:
    toml_data = toml.load(config_file)

app = Quart(__name__)
app.config.from_mapping(toml_data)
config = app.config

app.static_folder = config['STATIC_PATH']
app.template_folder = config['STATIC_PATH']
app.secret_key = config['SECRET_KEY']

jwt = JWTManager(app)

app.engine = Database(f"sqlite:///{app.config['DB_FILE']}")

@app.route('/')
async def index():
    """Default route"""
    return await render_template("index.html")

@app.websocket('/api/v1/ws')
async def wsocket():
    """Websocket"""
    token = websocket.cookies.get(config['JWT_ACCESS_COOKIE_NAME'])

    if token is None:
        await websocket.close(code=400, reason='Missing JWT')
        return
    try:
        data = decode_token(token)
    except Exception as e:
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
        return jsonify({'error': 'Not found'}), 404
    return await render_template("index.html")

app.register_blueprint(api_auth)
app.register_blueprint(api_world)

if __name__ == "__main__":
    app.run(host='localhost', port=8080)
