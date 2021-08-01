#!/usr/bin/env python
"""API routes"""

import uuid
import asyncio
from quart import request, jsonify, Blueprint
from quart_auth import login_user, logout_user, login_required, current_user
from user import User, authorized_users
from world import World

api_auth = Blueprint('api_auth', __name__, url_prefix='/api/v1/auth')
api_world = Blueprint('api_world', __name__, url_prefix='/api/v1/world')

@api_auth.route('/', methods=['POST'], strict_slashes=False)
async def auth_login():
    """User login"""
    data = await request.json
    user_id = str(uuid.uuid4())[:8]
    user = User(user_id)
    user._name = data['login'] or 'Anonymous'+user_id
    user.queue = asyncio.Queue()
    login_user(user, True)
    authorized_users.add(user)
    return jsonify({'id': user_id, 'name': await user.name}), 200

@api_auth.route('/', methods=['DELETE'], strict_slashes=False)
@login_required
async def auth_logout():
    """User logout"""
    logout_user()
    return {}, 200

@api_auth.route('/', methods=['GET'], strict_slashes=False)
@login_required
async def auth_session():
    """User session"""
    if await current_user.name:
        return jsonify({'id': current_user.auth_id, 'name': await current_user.name}), 200
    return {}, 401

@api_world.route('/', methods=['GET'])
@login_required
async def world_list():
    """World list"""
    return jsonify(await World.get_list()), 200

@api_world.route('/<world_id>', methods=['GET'])
@login_required
async def world_get(world_id):
    """World fetching"""
    for user in authorized_users:
        if user.auth_id == current_user.auth_id:
            world = await World(world_id).to_dict()
            if world['name'] is None:
                return world, 404
            return world, 200
    return {}, 401
