#!/usr/bin/env python
import asyncio
from math import atan2, pi
from bot import Bot
from random import randint

WEB_URL = 'http://localhost:8080/api/v1'
WS_URL = 'ws://localhost:8080/ws'

class Bobinot(Bot):
    def __init__(self, *args, **kwargs):
        super(Bobinot, self).__init__(*args, **kwargs)
        self.name = 'bobinot'
        self.following = None
        self.move_speed = 0.2
        self.avatar = 12
        self.current_move_thread = 0
        self.logging_enabled = False

    async def move(self, dest_x: float, dest_z: float) -> None:
        thread_id = self.current_move_thread
        tick = 200
        length = ((dest_x - self.x) ** 2 + (dest_z - self.z) ** 2) ** 0.5
        direction = atan2(dest_x - self.x, dest_z - self.z) + pi
        n = int(length * (1 / self.move_speed))
        if n > 0:
            x_gap = (dest_x - self.x) / n
            z_gap = (dest_z - self.z) / n
            gaps = [[self.x + i * x_gap, self.z + i * z_gap] for i in range(1, n + 1)]
        else:
            gaps = [[dest_x, dest_z]]
        for p in gaps:
            if thread_id != self.current_move_thread:
                break
            self.set_position(p[0], self.y, p[1], yaw=direction)
            await self.send_position()
            await asyncio.sleep(tick / 1e3)

    async def on_connected(self) -> None:
        await self.change_avatar(self.avatar)
        await self.send_msg('hello')
        await self.send_position()

    async def on_user_join(self, msg: str) -> None:
        print(f"* {msg} joined")

    async def on_user_part(self, msg:str) -> None:
        print(f"* {msg} left")

    async def on_msg(self, user: str, msg: str) -> None:
        print(f"<{user}> {msg}")
        if user != self.name:
            if msg.startswith('!list'):
                l = ' '.join([u.name + '(' + str(u.avatar) + ':' + i + ')' for i, u in self.userlist.items()])
                await self.send_msg(l)
            elif msg.startswith('!pos'):
                await self.send_msg(f'{self.x},{self.y},{self.z}')
            elif msg.startswith('!come'):
                await self.send_msg('Coming...')
                for i, u in self.userlist.items():
                    if u.name == user:
                        self.current_move_thread += 1
                        asyncio.ensure_future(self.move(u.x, u.z))
            elif msg.startswith('!change'):
                await self.change_avatar(randint(0, 14))

b = Bobinot(WEB_URL, WS_URL)
b.run()
