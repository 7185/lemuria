#!/usr/bin/env python

from quart import websocket
from quart_auth import AuthUser, _AuthSerializer
from utils import Timer
from config import Config

authorized_users = set()

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
        self.orientation = [0, 0, 0]
        self.pos_timer = None

    def to_dict(self):
        return {
            'id': self.auth_id,
            'name': self.name,
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
            self.pos_timer = Timer(Config.POSITION_UPDATE_TICK, self.send_pos)

    async def send_pos(self):
        await broadcast({'type': 'pos', 'user': self.auth_id, 'data': {'pos': {'x': self.position[0], 'y': self.position[1], 'z': self.position[2]},
                                                                       'ori': {'x': self.orientation[0], 'y': self.orientation[1], 'z': self.orientation[2]}}})
        await self.init_timer()


async def broadcast(message):
    for user in [u for u in authorized_users if u.connected]:
        await user.queue.put(message)