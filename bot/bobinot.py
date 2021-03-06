#!/usr/bin/env python
import trio
from math import atan2, pi
from bot import Bot
from random import randint

WEB_URL = 'https://lemuria.7185.fr/api/v1'
WS_URL = 'wss://lemuria.7185.fr/ws'

class Bobinot(Bot):
    def __init__(self, *args, **kwargs):
        super(Bobinot, self).__init__(*args, **kwargs)
        self.name = 'bobinot'
        self.following = None
        self.move_speed = 1
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
            await trio.sleep(tick / 1e3)

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
                l = ' '.join([f'{u.name}({u.avatar}:{i})' for i, u in self.userlist.items()])
                await self.send_msg(l)
            elif msg.startswith('!pos'):
                await self.send_msg(f'{self.x},{self.y},{self.z}')
            elif msg.startswith('!come'):
                await self.send_msg('Coming...')
                for u in self.userlist.values():
                    if u.name == user:
                        self.current_move_thread += 1
                        self.nursery.start_soon(self.move, u.x, u.z)
            elif msg.startswith('!whereami'):
                for u in self.userlist.values():
                    if u.name == user:
                        await self.send_msg(f'{u.x},{u.y},{u.z}')
            elif msg.startswith('!speed'):
                value = 1
                m = msg.split(' ')
                if len(m) > 1 and m[1].isdigit():
                    value = m[1]
                self.move_speed = int(value)
                await self.send_msg(f'Running at {self.move_speed}')
            elif msg.startswith('!change'):
                await self.change_avatar(randint(0, 16))

b = Bobinot(WEB_URL, WS_URL)
b.run()
