#!/usr/bin/env python
import asyncio
import uuid
from functools import wraps
from quart import websocket
from quart_auth import AuthManager, AuthUser, current_user, login_required, _AuthSerializer
from config import Config
from user import authorized_users, broadcast, User


def collect_websocket(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        u = User.current()
        if u is None:
            return
        if u.queue is None:
            u.queue = asyncio.Queue()
        u.websockets.add(websocket._get_current_object())
        u.connected = True
        await u.init_timer()
        await broadcast({'type': 'join', 'data': u.name})
        await broadcast({'type': 'list', 'data': [u.to_dict() for u in [u for u in authorized_users if u.connected]]})
        try:
            return await func(u, *args, **kwargs)
        finally:
            u.websockets.remove(websocket._get_current_object())
            if len(u.websockets) == 0:
                u.connected = False
                await broadcast({'type': 'part', 'data': u.name})
                await broadcast({'type': 'list', 'data': [u.to_dict() for u in [u for u in authorized_users if u.connected]]})
    return wrapper


@collect_websocket
async def sending(user=None):
    while True:
        data = await user.queue.get()
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
        await broadcast({'type': 'msg', 'user': user.name, 'data': data['data']})
    elif data['type'] == 'pos':
        user.position[0] = data['data']['pos']['x']
        user.position[1] = data['data']['pos']['y']
        user.position[2] = data['data']['pos']['z']
        user.orientation[0] = data['data']['ori']['x']
        user.orientation[1] = data['data']['ori']['y']
        user.orientation[2] = data['data']['ori']['z']