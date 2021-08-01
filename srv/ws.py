#!/usr/bin/env python
from quart import websocket
from user import authorized_users, broadcast, User


async def sending(user: User):
    await broadcast({'type': 'join', 'data': await user.name})
    await broadcast({'type': 'list',
                     'data': [await u.to_dict() for u in [u for u in authorized_users if u.connected]]})
    try:
        while True:
            data = await user.queue.get()
            for socket in user.websockets:
                await socket.send_json(data)
    finally:
        user.websockets.remove(websocket._get_current_object())
        if len(user.websockets) == 0:
            user.connected = False
            await broadcast({'type': 'part', 'data': await user.name})
            await broadcast({'type': 'list',
                             'data': [await u.to_dict() for u in [u for u in authorized_users if u.connected]]})


async def receiving(user: User):
    while True:
        data = await websocket.receive_json()
        await process_msg(user, data)


async def process_msg(user: User, data: dict) -> None:
    if data['type'] == 'msg':
        await broadcast({'type': 'msg', 'user': await user.name, 'data': data['data']})
    elif data['type'] == 'pos':
        user.position[0] = data['data']['pos']['x']
        user.position[1] = data['data']['pos']['y']
        user.position[2] = data['data']['pos']['z']
        user.orientation[0] = data['data']['ori']['x']
        user.orientation[1] = data['data']['ori']['y']
        user.orientation[2] = data['data']['ori']['z']
    elif data['type'] == 'avatar':
        user.avatar = data['data']
        await broadcast({'type': 'avatar', 'user': user.auth_id, 'data': user.avatar})
