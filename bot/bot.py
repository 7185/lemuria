
#!/usr/bin/env python

import requests
import websockets
import asyncio
import json

def get_cookie_from_response(response, cookie_name):
    cookies = response.cookies.get_dict()
    if cookie_name in cookies:
        return cookies[cookie_name]
    return None

SSL_VERIFY = False
AUTH_COOKIE = 'QUART_AUTH'

class User:
    def __init__(self, nick: str="") -> None:
        self.nickname = nick
        self.x = 0.0
        self.y = 0.0
        self.z = 0.0
        self.pitch = 0.0
        self.yaw = 0.0

    def set_position(self, x: float = 0.0, y: float = 0.0, z: float = 0.0, pitch: float = 0.0, yaw: float = 0.0):
        self.x = x
        self.y = y
        self.z = z
        self.pitch = pitch
        self.yaw = yaw


class Bot(User):
    def __init__(self, web_url: str, ws_url: str, logging_enabled: bool=True) -> None:
        super(Bot, self).__init__()
        self.web_url = web_url
        self.ws_url = ws_url
        self.ws = None
        self.logging_enabled = logging_enabled
        self.connected = False
        self.handlers = {}
        self.userlist = {}
        self.cookiejar = {}

    def log(self, txt: str) -> None:
        if self.logging_enabled:
            print(txt)

    async def _callback(self, name: str, *parameters) -> None:
        for inst in [self] + list(self.handlers.values()):
            f = getattr(inst, name, None)
            if not hasattr(f, '__call__'):
                continue
            self.log('calling %s() on instance %r' % (name, inst))
            if f is not None:
                await f(*parameters)

    async def _process_msg(self, msg: dict) -> None:
        self.log('> ' + str(msg))
        if not 'type' in msg:
            self.log('* unknown message')
        t = msg['type']
        if t == 'msg':
            await self._callback('on_msg', msg['user'], msg['data'])
        elif t == 'list':
            self.userlist.clear()
            for u in msg['data']:
                self.userlist[u['id']]=(User(u['name']))
            await self._callback('on_user_list')
        elif t == 'join':
            await self._callback('on_user_join', msg['data'])
        elif t == 'part':
            await self._callback('on_user_part', msg['data'])

    
    async def send(self, msg: dict) -> None:
        if self.ws is not None:
            await self.ws.send(json.dumps(msg))
            self.log('< ' + str(msg))
        else:
            self.log('* Websocket not initialized')

    async def send_msg(self, msg: str) -> None:
        await self.send({'type': 'msg', 'data': msg})
        await self._callback('on_self_msg', msg)


    async def reader(self, websocket) -> None:
        async for message_raw in websocket:
            msg = json.loads(message_raw)
            await self._process_msg(msg)

    async def login(self) -> None:
        rlogin = requests.post(self.web_url + '/auth', json={'login': self.nickname, 'password': 'password'}, verify=SSL_VERIFY)

        self.cookiejar = {
            AUTH_COOKIE: get_cookie_from_response(rlogin, AUTH_COOKIE)
        }

    async def connect(self) -> None:
        await self.login()
        async with websockets.connect(self.ws_url, extra_headers=[('Cookie', AUTH_COOKIE+'='+self.cookiejar[AUTH_COOKIE])]) as websocket:
            self.ws = websocket
            self.log('@ Connected')
            self.connected = True
            await self._callback('on_connected')
            consumer_task = asyncio.ensure_future(self.reader(websocket))
            done = await asyncio.wait(
                [consumer_task],
                return_when=asyncio.FIRST_COMPLETED,
            )
            self.connected = False
            self.log('@ Disconnected')
            await self._callback('on_disconnected')

    def run(self) -> None:
        asyncio.get_event_loop().run_until_complete(self.connect())
