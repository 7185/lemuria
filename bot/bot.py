#!/usr/bin/env python

import asks
import trio
import trio_websocket
import json

asks.init(trio)

def get_cookie_from_response(response, cookie_name):
    for c in response.cookies:
        if c.name == cookie_name:
            return c.value
    return None

AUTH_COOKIE = 'QUART_AUTH'
DEBUG = False

class User:
    def __init__(self, name: str="") -> None:
        self.name = name
        self.x = 0.0
        self.y = 0.0
        self.z = 0.0
        self.roll = 0.0
        self.yaw = 0.0
        self.pitch = 0.0
        self.avatar = 0

    def set_position(self, x: float = 0.0, y: float = 0.0, z: float = 0.0, roll: float = 0.0, yaw: float = 0.0, pitch: float = 0.0,):
        self.x = x
        self.y = y
        self.z = z
        self.roll = roll
        self.yaw = yaw
        self.pitch = pitch

class Bot(User):
    def __init__(self, web_url: str, ws_url: str, logging_enabled: bool=True) -> None:
        super(Bot, self).__init__()
        self.web_url = web_url
        self.ws_url = ws_url
        self.ws = None
        self.nursery = None
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
            if DEBUG:
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
                self.userlist[u['id']] = User(u['name'])
                self.userlist[u['id']].avatar = u['avatar']
            await self._callback('on_user_list')
        elif t == 'join':
            await self._callback('on_user_join', msg['data'])
        elif t == 'part':
            await self._callback('on_user_part', msg['data'])
        elif t == 'pos':
            for u in self.userlist:
                if u == msg['user']:
                    self.userlist[u].x = msg['data']['pos']['x']
                    self.userlist[u].y = msg['data']['pos']['y']
                    self.userlist[u].z = msg['data']['pos']['z']
                    self.userlist[u].roll = msg['data']['ori']['x']
                    self.userlist[u].yaw = msg['data']['ori']['y']
                    self.userlist[u].pitch = msg['data']['ori']['z']
            await self._callback('on_user_pos', msg['user'], msg['data'])
        elif t == 'avatar':
            for u in self.userlist:
                if u == msg['user']:
                    self.userlist[u].avatar = msg['data']
            await self._callback('on_user_avatar', msg['user'], msg['data'])

    
    async def send(self, msg: dict) -> None:
        if self.ws is not None:
            await self.ws.send_message(json.dumps(msg))
            self.log('< ' + str(msg))
        else:
            self.log('* Websocket not initialized')

    async def send_msg(self, msg: str) -> None:
        await self.send({'type': 'msg', 'data': msg})
        await self._callback('on_self_msg', msg)

    async def send_position(self) -> None:
        await self.send({'type': 'pos', 'data': {'pos': {'x': round(self.x, 2),
                                                         'y': round(self.y, 2), 
                                                         'z': round(self.z, 2)},
                                                 'ori': {'x': round(self.roll),
                                                         'y': round(self.yaw),
                                                         'z': round(self.pitch)}}})

    async def change_avatar(self, avatar: int) -> None:
        self.avatar = avatar
        await self.send({'type': 'avatar', 'data': self.avatar})

    async def reader(self, websocket) -> None:
        while True:
            try:
                message_raw = await websocket.get_message()
                msg = json.loads(message_raw)
                await self._process_msg(msg)
            except trio_websocket.ConnectionClosed:
                break

    async def login(self) -> None:
        rlogin = await asks.post(self.web_url + '/auth', json={'login': self.name, 'password': 'password'})
        self.cookiejar = {
            AUTH_COOKIE: get_cookie_from_response(rlogin, AUTH_COOKIE)
        }

    async def connect(self) -> None:
        await self.login()
        async with trio_websocket.open_websocket_url(self.ws_url, extra_headers=[('Cookie', AUTH_COOKIE+'='+self.cookiejar[AUTH_COOKIE])]) as websocket:
            self.ws = websocket
            self.log('@ Connected')
            self.connected = True
            await self._callback('on_connected')
            async with trio.open_nursery() as nursery:
                self.nursery = nursery
                nursery.start_soon(self.reader, websocket)
            self.connected = False
            self.log('@ Disconnected')
            await self._callback('on_disconnected')

    def run(self) -> None:
        trio.run(self.connect)
