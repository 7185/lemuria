#!/usr/bin/env python
import asyncio
from datetime import datetime
from math import atan2, pi
from random import randint
from bot import Bot

WEB_URL = 'https://lemuria.7185.fr/api/v1'
WS_URL = 'wss://lemuria.7185.fr/api/v1/ws'

class Bonobot(Bot):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.name = '[bonobot]'
        self.following = None
        self.move_speed = 1
        self.current_move_thread = 0
        self.logging_enabled = False

    async def move(self, dest_x: float, dest_z: float) -> None:
        thread_id = self.current_move_thread
        tick = 200
        dx = dest_x - self.x
        dz = dest_z - self.z
        length = (dx ** 2 + dz ** 2) ** 0.5
        direction = atan2(dx, dz) + pi
        self.state = 'walk'
        num_step = int(length * (1 / self.move_speed))
        if num_step > 0:
            x_gap = dx / num_step
            z_gap = dz / num_step
            gaps = [[self.x + i * x_gap, self.z + i * z_gap] for i in range(1, num_step + 1)]
        else:
            gaps = [[dest_x, dest_z]]
        for step in gaps:
            if thread_id != self.current_move_thread:
                break
            self.set_position(step[0], self.y, step[1], yaw=direction)
            await self.send_position()
            await asyncio.sleep(tick / 1e3)
        self.state = 'idle'
        await self.send_position()

    async def on_connected(self) -> None:
        await self.change_avatar(self.avatar)
        await self.get_world_list()
        for i, w in self.worldlist.items():
            if w['name'] == 'Village':
                await self.world_enter(i)
        await self.send_msg('hello')
        await self.send_position()

    async def on_user_join(self, msg: str) -> None:
        user = self.userlist.get(msg)
        name = msg if user is None else user.name
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] * {name} joined")

    async def on_user_part(self, msg: str) -> None:
        user = self.userlist.get(msg)
        name = msg if user is None else user.name
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] * {name} left")

    async def on_msg(self, user_id: str, msg: str) -> None:
        user = self.userlist.get(user_id)
        name = user_id if user is None else user.name
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] <{name}> {msg}")

        # Return early if the message is from the bot itself
        if user.name == self.name:
            return

        # Parse the message and extract the command and arguments
        command, *args = msg.split()

        # Handle the different commands
        if command == "!list":
            l = ' '.join([f"{u.name}({u.avatar}:{i})" for i, u in self.userlist.items()])
            await self.send_msg(l)
        elif command == "!pos":
            await self.send_msg(f"{self.x},{self.y},{self.z}")
        elif command == "!come":
            if user is None:
                await self.send_msg("Sorry, I don't know who you are.")
            elif user.world != self.world:
                await self.send_msg(f"Sorry, I'm on {self.worldlist[self.world]['name'] if self.world else 'Nowhere'}...")
            else:
                await self.send_msg("Coming...")
                self.current_move_thread += 1
                asyncio.create_task(self.move(user.x, user.z))
        elif command == "!whereami":
            if user is None:
                await self.send_msg("Sorry, I don't know who you are.")
            else:
                await self.send_msg(f"{user.x},{user.y},{user.z}")
        elif command == "!speed":
            try:
                value = int(args[0])
            except (IndexError, ValueError):
                value = 1
            self.move_speed = value
            await self.send_msg(f"Running at {self.move_speed}")
        elif command == "!change":
            await self.change_avatar(randint(0, 16))

b = Bonobot(WEB_URL, WS_URL)
b.run()
