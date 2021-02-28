#!/usr/bin/env python
import asyncio
import uuid
from functools import wraps
from contextlib import suppress
from typing import Callable
from quart import websocket
from quart_auth import AuthManager, AuthUser, current_user, login_required, _AuthSerializer
from config import Config

class Timer:
    def __init__(self, timeout: int, callback: Callable) -> None:
        self._timeout = timeout
        self._callback = callback
        self._task = asyncio.ensure_future(self._job())

    async def _job(self) -> None:
        await asyncio.sleep(self._timeout)
        await self._callback()

    async def cancel(self) -> None:
        if not self._task.cancelled():
            self._task.cancel()
            with suppress(asyncio.CancelledError):
                await self._task


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
        self.position = [0, 0, 0]
        self.pos_timer = None

    def to_dict(self):
        return {
            'id': self.auth_id,
            'name': self.name,
            'x': self.position[0],
            'y': self.position[1],
            'z': self.position[2]
        }

    async def init_timer(self):
        if self.pos_timer:
            await self.pos_timer.cancel()
        if self.connected:
            self.pos_timer = Timer(Config.POSITION_UPDATE_TICK, self.send_pos)

    async def send_pos(self):
        await broadcast({'type': 'pos', 'user': self.auth_id, 'data': {'x': self.position[0], 'y': self.position[1], 'z': self.position[2]}})
        await self.init_timer()

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
        await process_msg(u, data)


async def process_msg(user: User, data: dict) -> None:
    if data['type'] == 'msg':
        await broadcast({'type': 'msg', 'user': user.name, 'data': data['data']})
    elif data['type'] == 'pos':
        user.position[0] = data['data']['x']
        user.position[1] = data['data']['y']
        user.position[2] = data['data']['z']
