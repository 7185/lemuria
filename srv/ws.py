#!/usr/bin/env python
import asyncio
import uuid
from functools import wraps
from quart import websocket
from quart_auth import AuthManager, AuthUser, current_user, login_required, _AuthSerializer

class User(AuthUser):
    @staticmethod
    def current():
        token = websocket.cookies['QUART_AUTH']
        serializer = _AuthSerializer('**changeme**', 'quart auth salt')
        user_id = serializer.loads(token)
        for u in authorized_users:
            if u.auth_id == user_id:
                return u
        return None


    def __init__(self, auth_id):
        super().__init__(auth_id)
        self.name = 'Anonymous'+str(auth_id)
        self.queue = None
        self.connected = False
        self.websockets = set()

    def to_dict(self):
        return {'id': self.auth_id, 'name': self.name}

authorized_users = set()

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
        await broadcast({'type': 'msg', 'data': u.name + " joined"})
        await broadcast({'type': 'list', 'data': [u.to_dict() for u in [u for u in authorized_users if u.connected]]})
        try:
            return await func(u, *args, **kwargs)
        finally:
            u.websockets.remove(websocket._get_current_object())
            if len(u.websockets) == 0:
                u.connected = False
                await broadcast({'type': 'msg', 'data': u.name + " left"})
                await broadcast({'type': 'list', 'data': [u.to_dict() for u in [u for u in authorized_users if u.connected]]})
    return wrapper

async def broadcast(message):
    for user in [u for u in authorized_users if u.connected]:
        await user.queue.put(message)

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
        if data['type'] == 'msg':
            await broadcast({'type': 'msg', 'user': u.name, 'data': data['data']})
