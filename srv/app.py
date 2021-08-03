#!/usr/bin/env python
"""App module"""

import asyncio
import toml
from quart import Quart, render_template, websocket, request, jsonify
from quart_auth import AuthManager, login_required
from sqlalchemy import create_engine
from sqlalchemy_aio import ASYNCIO_STRATEGY
from api import api_auth, api_world
from ws import sending, receiving
from user import User

app = Quart(__name__)
app.config.from_file('config.toml', toml.load)
config = app.config

app.static_folder = config['STATIC_PATH']
app.template_folder = config['STATIC_PATH']
app.secret_key = config['SECRET_KEY']

auth_manager = AuthManager()
auth_manager.user_class = User

app.engine = create_engine(f"sqlite:///{app.config['DB_FILE']}", strategy=ASYNCIO_STRATEGY)

@app.route('/')
async def index():
    """Default route"""
    return await render_template("index.html")

@app.websocket('/ws')
@login_required
async def wsocket():
    """Websocket"""
    user = User.current()
    if user is None:
        return
    user.websockets.add(websocket._get_current_object())
    user.connected = True
    await user.init_timer()
    producer = asyncio.create_task(sending(user))
    consumer = asyncio.create_task(receiving(user))
    await asyncio.gather(producer, consumer)

@app.errorhandler(404)
async def redirect(_):
    """Redirect everything to index"""
    if '/api/' in request.url:
        return jsonify({'error': 'Not found'}), 404
    return await render_template("index.html")

auth_manager.init_app(app)
app.register_blueprint(api_auth)
app.register_blueprint(api_world)

if __name__ == "__main__":
    app.run(host='localhost', port=8080)
