#!/usr/bin/env python

from bot import Bot

WEB_URL = 'http://localhost:8080/api/v1'
WS_URL = 'ws://localhost:8080/ws'

class Bobinot(Bot):
    def __init__(self, *args, **kwargs):
        super(Bobinot, self).__init__(*args, **kwargs)
        self.nickname = 'bobinot'

    async def on_connected(self) -> None:
        await self.send_msg('hello')

    async def on_msg(self, user: str, msg: str) -> None:
        if user != self.nickname:
            if msg.startswith('!list'):
                l = ' '.join([user.nickname + '(' + i + ')' for i, user in self.userlist.items()])
                await self.send_msg(l)
            else:
                await self.send_msg(msg)

b = Bobinot(WEB_URL, WS_URL)
b.run()