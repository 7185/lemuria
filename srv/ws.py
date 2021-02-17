#!/usr/bin/env python
import asyncio
import uuid
from functools import wraps
from quart import websocket
from quart_auth import AuthManager, current_user, login_required, _AuthSerializer

class User(object):
    """TODO: Inherit from Authuser"""
    @staticmethod
    def current():
        token = websocket.cookies['QUART_AUTH']
        serializer = _AuthSerializer('**changeme**', 'quart auth salt')
        user_id = serializer.loads(token)
        for u in connected_websockets:
            if u.id == user_id:
                return u
        u = User()
        u.id = user_id
        u.name = 'Anonymous'+str(user_id)
        return u


    def __init__(self):
        self.id = 0
        self.name = 'Anonymous'
        self.queue = asyncio.Queue()

    def to_dict(self):
        return {'id': self.id, 'name': self.name}

connected_websockets = set()

def collect_websocket(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        u = User.current()
        connected_websockets.add(u)
        await broadcast({'type': 'msg', 'data': u.name + " joined"})
        await broadcast({'type': 'list', 'data': [u.to_dict() for u in connected_websockets]})
        try:
            return await func(u, *args, **kwargs)
        finally:
            await broadcast({'type': 'msg', 'data': u.name + " left"})
            connected_websockets.remove(u)
            await broadcast({'type': 'list', 'data': [u.to_dict() for u in connected_websockets]})
    return wrapper

async def broadcast(message):
    for user in connected_websockets:
        await user.queue.put(message)

@collect_websocket
async def sending(user=None):
    while True:
        data = await user.queue.get()
        await websocket.send_json(data)

async def receiving():
    u = User.current()
    while True:
        data = await websocket.receive_json()
        if data['type'] == 'msg':
            await broadcast({'type': 'msg', 'user': u.name, 'data': data['data']})
