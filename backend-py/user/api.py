#!/usr/bin/env python
"""User API routes"""

import uuid
import asyncio
from quart import request, jsonify, Blueprint
from quart_jwt_extended import create_access_token, jwt_refresh_token_required, create_refresh_token, set_access_cookies, set_refresh_cookies, get_jwt_identity, jwt_required, unset_jwt_cookies
from user.model import User, authorized_users

api_auth = Blueprint('api_auth', __name__, url_prefix='/api/v1/auth')

@api_auth.route('/', methods=['POST'])
async def auth_login():
    """User login"""
    data = await request.json
    user_id = str(uuid.uuid4())[:8]
    user = User(user_id)
    user._name = data['login'] or f'Anonymous{user_id}'
    user.queue = asyncio.Queue()
    authorized_users.add(user)
    access_token = create_access_token(identity=user_id)
    refresh_token = create_refresh_token(identity=user_id)

    resp = jsonify({'id': user_id, 'name': await user.name})
    set_access_cookies(resp, access_token)
    set_refresh_cookies(resp, refresh_token)
    return resp, 200

@api_auth.route('/', methods=['DELETE'])
async def auth_logout():
    """User logout"""
    resp = jsonify({})
    unset_jwt_cookies(resp)
    return resp, 200

@api_auth.route('/', methods=['GET'])
@jwt_required
async def auth_session():
    """User session"""
    if curr_user := next((user for user in authorized_users if user.auth_id == get_jwt_identity()), None):
        return jsonify({'id': curr_user.auth_id, 'name': await curr_user.name}), 200
    return {}, 401

@api_auth.route("/renew", methods=["POST"])
@jwt_refresh_token_required
async def auth_renew():
    """User token renewal"""
    if curr_user := next((user for user in authorized_users if user.auth_id == get_jwt_identity()), None):
        access_token = create_access_token(identity=curr_user.auth_id)
        resp = jsonify({'id': curr_user.auth_id, 'name': await curr_user.name})
        set_access_cookies(resp, access_token)
        return resp, 200
    return {}, 401
