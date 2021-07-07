#!/usr/bin/env python
import uuid
from quart import request, jsonify, Blueprint
from quart_auth import login_user, logout_user, login_required, current_user
from user import User, authorized_users

api_auth = Blueprint('api_auth', __name__, url_prefix='/api/v1/auth')
api_world = Blueprint('api_world', __name__, url_prefix='/api/v1/world')

@api_auth.route('/', methods=['POST'], strict_slashes=False)
async def auth_login():
    data = await request.json
    user_id = str(uuid.uuid4())[:8]
    u = User(user_id)
    u._name = data['login'] or 'Anonymous'+user_id
    login_user(u, True)
    authorized_users.add(u)
    return jsonify({'id': user_id, 'name': await u.name}), 200

@api_auth.route('/', methods=['DELETE'], strict_slashes=False)
@login_required
async def auth_logout():
    logout_user()
    return {}, 200

@api_auth.route('/', methods=['GET'], strict_slashes=False)
@login_required
async def auth_session():
    if await current_user.name:
        return jsonify({'id': current_user.auth_id, 'name': await current_user.name}), 200
    return {}, 401

@api_world.route('/<world_id>', methods=['GET'])
@login_required
async def world(world_id):
    from world import World
    for u in authorized_users:
        if (u.auth_id == current_user.auth_id):
            w = await World(world_id).to_dict()
            if w['name'] is None:
                return w, 404
            return w, 200
    return {}, 401