#!/usr/bin/env python
"""User module"""

from quart import current_app
from utils.timer import Timer

authorized_users = set()

async def broadcast(message):
    for user in [u for u in authorized_users if u.connected]:
        await user.queue.put(message)

async def broadcast_world(world, message):
    for user in [u for u in authorized_users if u.connected and u.world == world]:
        if message['type'] == 'pos' and message['user'] == user.auth_id:
            continue
        await user.queue.put(message)

async def broadcast_userlist():
    await broadcast({'type': 'list',
                     'data': [await u.to_dict() for u in [u for u in authorized_users if u.connected]]})


class User:
    """User class"""
    @staticmethod
    def get(uid):
        return next((user for user in authorized_users if user.auth_id == uid), None)

    def __init__(self, auth_id):
        self.auth_id = auth_id
        self._resolved = False
        self._name = None
        self.queue = None
        self.connected = False
        self.websockets = set()
        self.position = [0, 0, 0]
        self.orientation = [0, 0, 0]
        self.avatar = 0
        self.state = 'idle'
        self.gesture = None
        self.world = 0
        self.pos_timer = None

    async def _resolve(self):
        if not self._resolved:
            for user in authorized_users:
                if user.auth_id == self.auth_id:
                    self._name = user._name
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
            'world': self.world,
            'state': self.state,
            'gesture': self.gesture,
            'x': self.position[0],
            'y': self.position[1],
            'z': self.position[2],
            'roll': self.orientation[0],
            'yaw': self.orientation[1],
            'pitch': self.orientation[2]
        }

    async def set_world(self, world_id):
        self.world = world_id
        await broadcast_userlist()

    async def set_timer(self):
        if self.pos_timer:
            await self.pos_timer.cancel()
        if self.connected:
            self.pos_timer = Timer(current_app.config['POSITION_UPDATE_TICK'], self.send_pos)
            await self.pos_timer.start()

    async def send_pos(self):
        await broadcast_world(self.world, {
            'type': 'pos', 'user': self.auth_id,
            'data': {'pos': {'x': self.position[0], 'y': self.position[1], 'z': self.position[2]},
                     'ori': {'x': self.orientation[0],
                             'y': self.orientation[1],
                             'z': self.orientation[2]},
                     'state': self.state, 'gesture': self.gesture}
            })
        await self.set_timer()

    async def send_avatar(self):
        await broadcast({'type': 'avatar', 'user': self.auth_id, 'data': self.avatar})
