#!/usr/bin/env python

from quart import websocket, json, g
from quart_auth import AuthUser, current_user
from utils import Timer
from config import Config

authorized_users = set()

class User(AuthUser):
    @staticmethod
    def current():
        for u in authorized_users:
            if (u.auth_id == current_user.auth_id):
                return u
        return None

    def __init__(self, auth_id):
        super().__init__(auth_id)
        self._resolved = False
        self._name = None
        self.queue_send = None
        self.queue_recv = None
        self.connected = False
        self.websockets = set()
        self.position = [0, 0, 0]
        self.orientation = [0, 0, 0]
        self.avatar = 0
        self.pos_timer = None

    async def _resolve(self):
        if not self._resolved:
            for u in authorized_users:
                if (u.auth_id == self.auth_id):
                    self._name = u._name
                    self._resolved = True
    
    @property
    async def name(self):
        await self._resolve()
        return self._name

    async def to_dict(self):
        return {
            'id': self.auth_id,
            'name': await self.name,
            'avatar': self.avatar,
            'x': self.position[0],
            'y': self.position[1],
            'z': self.position[2],
            'roll': self.orientation[0],
            'yaw': self.orientation[1],
            'picth': self.orientation[2]
        }

    async def init_timer(self):
        if self.pos_timer:
            await self.pos_timer.cancel()
        if self.connected:
            self.pos_timer = Timer(Config.POSITION_UPDATE_TICK, self.send_pos, g.nursery)
            await self.pos_timer.start()

    async def send_pos(self):
        await broadcast({'type': 'pos', 'user': self.auth_id, 'data': {'pos': {'x': self.position[0], 'y': self.position[1], 'z': self.position[2]},
                                                                       'ori': {'x': self.orientation[0], 'y': self.orientation[1], 'z': self.orientation[2]}}})
        await self.init_timer()
    
    async def send_avatar(self):
        await broadcast({'type': 'avatar', 'user': self.auth_id, 'data': self.avatar})

async def broadcast(message):
    for user in [u for u in authorized_users if u.connected]:
        msg = json.dumps(message)
        await user.queue_send.send(msg)