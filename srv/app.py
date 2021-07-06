#!/usr/bin/env python
import trio
from quart import g, render_template, websocket, request, jsonify
from quart_trio import QuartTrio
from quart_auth import AuthManager, login_required
from sqlalchemy import create_engine
from sqlalchemy_aio import TRIO_STRATEGY
from api import api_auth, api_world
from ws import sending, receiving
from user import User

app = QuartTrio(__name__)
app.config.from_object('config.Config')
app.static_folder = app.config['STATIC_PATH']
app.template_folder = app.config['STATIC_PATH']

auth_manager = AuthManager()
auth_manager.user_class = User

app.secret_key = app.config['SECRET_KEY']
app.engine = create_engine(f"sqlite:///{app.config['DB_FILE']}", strategy=TRIO_STRATEGY)

@app.route('/')
async def index():
    return await render_template("index.html")

@app.websocket('/ws')
@login_required
async def wsocket():
    async with trio.open_nursery() as nursery:
        g.nursery = nursery
        nursery.start_soon(sending)
        nursery.start_soon(receiving)

@app.errorhandler(404)
async def redirect(e):
    if '/api/' in request.url:
        return jsonify({'error': 'Not found'}), 404
    return await render_template("index.html")

auth_manager.init_app(app)
app.register_blueprint(api_auth)
app.register_blueprint(api_world)

if __name__ == "__main__":
    app.run(host='localhost', port=8080)
