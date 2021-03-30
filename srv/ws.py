#!/usr/bin/env python
import trio
import uuid
from functools import wraps
from quart import websocket, jsonify, json
from quart_auth import AuthManager, AuthUser, current_user, login_required, _AuthSerializer
from config import Config
from user import authorized_users, broadcast, User


def collect_websocket(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        u = User.current()
        if u is None:
            return
        if u.queue_send is None:
            u.queue_send, u.queue_recv = trio.open_memory_channel(100)
        u.websockets.add(websocket._get_current_object())
        u.connected = True
        await u.init_timer()
        await broadcast({'type': 'join', 'data': await u.name})
        await broadcast({'type': 'list', 'data': [await u.to_dict() for u in [u for u in authorized_users if u.connected]]})
        try:
            return await func(u, *args, **kwargs)
        finally:
            u.websockets.remove(websocket._get_current_object())
            if len(u.websockets) == 0:
                u.connected = False
                await broadcast({'type': 'part', 'data': await u.name})
                await broadcast({'type': 'list', 'data': [await u.to_dict() for u in [u for u in authorized_users if u.connected]]})
    return wrapper


@collect_websocket
async def sending(user=None):
    while True:
        data = await user.queue_recv.receive()
        data = json.loads(data)
        for s in user.websockets:
            await s.send_json(data)


async def receiving():
    u = User.current()
    if u is None:
        return
    while True:
        data = await websocket.receive_json()
        await process_msg(u, data)


async def process_msg(user: User, data: dict) -> None:
    if data['type'] == 'msg':
        await broadcast({'type': 'msg', 'user': await user.name, 'data': data['data']})
    elif data['type'] == 'pos':
        user.position[0] = data['data']['pos']['x']
        user.position[1] = data['data']['pos']['y']
        user.position[2] = data['data']['pos']['z']
        user.orientation[0] = data['data']['ori']['x']
        user.orientation[1] = data['data']['ori']['y']
        user.orientation[2] = data['data']['ori']['z']
    elif data['type'] == 'avatar':
        user.avatar = data['data']
        await broadcast({'type': 'avatar', 'user': user.auth_id, 'data': user.avatar})
