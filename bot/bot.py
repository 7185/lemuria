#!/usr/bin/env python
"""Bot module"""

import json
import asks
import trio
import trio_websocket

asks.init(trio)

def get_cookie_from_response(response, cookie_name):
    """Returns cookie value of cookie_name"""
    return next((c.value for c in response.cookies if c.name == cookie_name), None)

AUTH_COOKIE = 'QUART_AUTH'
DEBUG = False

class User:
    """User class"""
    def __init__(self, name: str="") -> None:
        self.name = name
        self.world = 0
        self.x = 0.0
        self.y = 0.0
        self.z = 0.0
        self.roll = 0.0
        self.yaw = 0.0
        self.pitch = 0.0
        self.avatar = 0
        self.state = 'idle'
        self.gesture = None

    def set_position(self, x: float = 0.0, y: float = 0.0, z: float = 0.0,
                     roll: float = 0.0, yaw: float = 0.0, pitch: float = 0.0,):
        self.x = x
        self.y = y
        self.z = z
        self.roll = roll
        self.yaw = yaw
        self.pitch = pitch

class Bot(User):
    """Bot class"""
    def __init__(self, web_url: str, ws_url: str, logging_enabled: bool=True) -> None:
        super().__init__()
        self.web_url = web_url
        self.ws_url = ws_url
        self.ws = None
        self.nursery = None
        self.logging_enabled = logging_enabled
        self.connected = False
        self.handlers = {}
        self.userlist = {}
        self.worldlist = {}
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
    self.log(f"> {msg}")

    # Return early if the message doesn't have a 'type' field
    if 'type' not in msg:
        self.log("* unknown message")
        return

    t = msg['type']

    # Handle the different message types
    if t == "avatar":
        user = self.userlist.get(msg["user"])
        if user is not None:
            user.avatar = msg["data"]
        await self._callback("on_user_avatar", msg["user"], msg["data"])
    elif t == "join":
        await self._callback("on_user_join", msg["data"])
    elif t == "list":
        self.userlist.clear()
        for u in msg["data"]:
            user = User(u["name"])
            user.avatar = u["avatar"]
            user.world = u["world"]
            self.userlist[u["id"]] = user
        await self._callback("on_user_list")
    elif t == "msg":
        await self._callback("on_msg", msg["user"], msg["data"])
    elif t == "part":
        await self._callback("on_user_part", msg["data"])
    elif t == "pos":
        user = self.userlist.get(msg["user"])
        if user is not None:
            data = msg["data"]
            user.x = data["pos"]["x"]
            user.y = data["pos"]["y"]
            user.z = data["pos"]["z"]
            user.roll = data["ori"]["x"]
            user.yaw = data["ori"]["y"]
            user.pitch = data["ori"]["z"]
            user.state = data["state"]
            user.gesture = data["gesture"]
        await self._callback("on_user_pos", msg["user"], msg["data"])

    async def send(self, msg: dict) -> None:
        if self.ws is not None:
            await self.ws.send_message(json.dumps(msg))
            self.log(f'< {msg}')
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
                                                         'z': round(self.pitch)},
                                                 'state': self.state,
                                                 'gesture': self.gesture}})

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
        rlogin = await asks.post(f'{self.web_url}/auth',
                                 json={'login': self.name, 'password': 'password'})
        self.cookiejar = {
            AUTH_COOKIE: get_cookie_from_response(rlogin, AUTH_COOKIE)
        }

    async def get_world_list(self) -> None:
        r_world_list = await asks.get(f'{self.web_url}/world/', cookies=self.cookiejar)
        self.worldlist.clear()
        for w in r_world_list.json():
            self.worldlist[w['id']] = {'name': w['name'], 'users': w['users']}

    async def world_enter(self, world_id) -> None:
        r_world = await asks.get(f'{self.web_url}/world/{world_id}', cookies=self.cookiejar)
        self.world = r_world.json()['id']

    async def connect(self) -> None:
        await self.login()
        await self.get_world_list()
        headers = [('Cookie', f"{AUTH_COOKIE}={self.cookiejar[AUTH_COOKIE]}")]
        async with trio_websocket.open_websocket_url(self.ws_url, extra_headers=headers) as websocket:
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
