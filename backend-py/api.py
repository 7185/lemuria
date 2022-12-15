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

@api_auth.route('/', methods=['POST'])
async def auth_login():
    """User login"""
    data = await request.json
    user_id = str(uuid.uuid4())[:8]
    user = User(user_id)
    user._name = data['login'] or f'Anonymous{user_id}'
    user.queue = asyncio.Queue()
    login_user(user, True)
    authorized_users.add(user)
    return jsonify({'id': user_id, 'name': await user.name}), 200

@api_auth.route('/', methods=['DELETE'])
@login_required
async def auth_logout():
    """User logout"""
    logout_user()
    return {}, 200

@api_auth.route('/', methods=['GET'])
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

@api_world.route('/<int:world_id>', methods=['GET'])
@login_required
async def world_get(world_id):
    """World fetching"""
    curr_user = next((user for user in authorized_users if user.auth_id == current_user.auth_id), None)
    
    if curr_user is None:
        return {}, 401
    
    world = await World(world_id).to_dict()
    if world['name'] is None:
        return world, 404
    
    await curr_user.set_world(world_id)
    return world, 200

@api_world.route('/<int:world_id>/props', methods=['GET'])
@login_required
async def world_props_get(world_id):
    """World props fetching"""
    curr_user = next((user for user in authorized_users if user.auth_id == current_user.auth_id), None)
    
    if curr_user is None:
        return {}, 401

    # Fetch all arguments
    min_x = request.args.get("min_x")
    max_x = request.args.get("max_x")
    min_y = request.args.get("min_y")
    max_y = request.args.get("max_y")
    min_z = request.args.get("min_z")
    max_z = request.args.get("max_z")

    # Convert them to integers when fitting 
    min_x = int(min_x) if min_x and min_x.lstrip('-').isdigit() else None
    max_x = int(max_x) if max_x and max_x.lstrip('-').isdigit() else None
    min_y = int(min_y) if min_y and min_y.lstrip('-').isdigit() else None
    max_y = int(max_y) if max_y and max_y.lstrip('-').isdigit() else None
    min_z = int(min_z) if min_z and min_z.lstrip('-').isdigit() else None
    max_z = int(max_z) if max_z and max_z.lstrip('-').isdigit() else None

    props = await World(world_id).props(min_x, max_x, min_y, max_y, min_z, max_z)

    return props, 200