#!/usr/bin/env python
"""World API routes"""

from quart import request, jsonify, Blueprint
from quart_jwt_extended import create_access_token, jwt_refresh_token_required, create_refresh_token, set_access_cookies, set_refresh_cookies, get_jwt_identity, jwt_required, unset_jwt_cookies
from user.model import User, authorized_users
from world.model import World

api_world = Blueprint('api_world', __name__, url_prefix='/api/v1/world')

@api_world.route('/', methods=['GET'])
@jwt_required
async def world_list():
    """World list"""
    return jsonify(await World.get_list()), 200

@api_world.route('/<int:world_id>', methods=['GET'])
@jwt_required
async def world_get(world_id):
    """World fetching"""
    if curr_user := next((user for user in authorized_users if user.auth_id == get_jwt_identity()), None):
        world = await World(world_id).to_dict()
        if world['name'] is None:
            return world, 404
        await curr_user.set_world(world_id)
        return world, 200
    return {}, 401

@api_world.route('/<int:world_id>/props', methods=['GET'])
@jwt_required
async def world_props_get(world_id):
    """World props fetching"""

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