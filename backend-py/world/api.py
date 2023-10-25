#!/usr/bin/env python
"""World API routes"""

from quart import request, Blueprint, current_app
from quart_jwt_extended import get_jwt_identity, jwt_required
from user.model import authorized_users
from world.model import World

api_world = Blueprint('api_world', __name__, url_prefix='/api/v1/world')

@api_world.before_request
@jwt_required
async def before_request():
    """Before request"""

@api_world.get('/')
async def world_list():
    """World list"""
    return await World.get_list(), 200

@api_world.get('/<int:world_id>')
async def world_get(world_id):
    """World fetching"""
    if curr_user := next(
        (user for user in authorized_users if user.auth_id == get_jwt_identity()),
    None):
        world = await World(world_id).to_dict()
        if world['name'] is None:
            return world, 404
        await curr_user.set_world(world_id)
        return world, 200
    return {}, 401

@api_world.get('/<int:world_id>/props')
async def world_props_get(world_id):
    """World props fetching"""
    cache = current_app.cache

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

    # Ignore Y for cache keys
    cache_key = f"P-{world_id}-{min_x}-{max_x}-{min_z}-{max_z}"
    if (props := cache.get(cache_key)) is not None:
        return props, 200

    props = await World(world_id).props(min_x, max_x, min_y, max_y, min_z, max_z)
    cache.set(cache_key, props)

    return props, 200


@api_world.get('/<int:world_id>/terrain')
async def get_terrain_page(world_id):
    cache = current_app.cache

    page_x = request.args.get("page_x")
    page_z = request.args.get("page_z")

    page_x = int(page_x) if page_x and page_x.lstrip('-').isdigit() else 0
    page_z = int(page_z) if page_z and page_z.lstrip('-').isdigit() else 0

    cache_key = f"T-{world_id}-{page_x}-{page_z}"
    if (page := cache.get(cache_key)) is not None:
        return page, 200

    page = await World(world_id).get_terrain_page(page_x, page_z)

    return page, 200
