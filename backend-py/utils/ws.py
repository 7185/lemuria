#!/usr/bin/env python
"""Websocket module"""

from quart import websocket
from user.model import broadcast, broadcast_userlist, User


async def sending(user: User):
    await broadcast({'type': 'join', 'data': await user.name})
    await broadcast_userlist()
    try:
        while True:
            data = await user.queue.get()
            for socket in user.websockets:
                await socket.send_json(data)
    finally:
        user.websockets.remove(websocket._get_current_object())
        if not user.websockets:
            user.connected = False
            # Force Timer cancel
            await user.set_timer()
            await broadcast({'type': 'part', 'data': await user.name})
            await broadcast_userlist()


async def receiving(user: User):
    while True:
        data = await websocket.receive_json()
        await process_msg(user, data)


async def process_msg(user: User, payload: dict) -> None:
    if payload['type'] == 'msg':
        await broadcast({'type': 'msg', 'user': await user.name, 'data': payload['data']})
    elif payload['type'] == 'pos':
        user.position[0] = payload['data']['pos']['x']
        user.position[1] = payload['data']['pos']['y']
        user.position[2] = payload['data']['pos']['z']
        user.orientation[0] = payload['data']['ori']['x']
        user.orientation[1] = payload['data']['ori']['y']
        user.orientation[2] = payload['data']['ori']['z']
        user.state = payload['data']['state']
        user.gesture = payload['data']['gesture']
    elif payload['type'] == 'avatar':
        user.avatar = payload['data']
        await broadcast({'type': 'avatar', 'user': user.auth_id, 'data': user.avatar})
