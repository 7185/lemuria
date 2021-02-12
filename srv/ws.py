#!/usr/bin/env python
import asyncio
from functools import wraps
from quart import websocket

connected_websockets = set()

def collect_websocket(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        global connected_websockets
        queue = asyncio.Queue()
        connected_websockets.add(queue)
        try:
            return await func(queue, *args, **kwargs)
        finally:
            connected_websockets.remove(queue)
    return wrapper

async def broadcast(message):
    for queue in connected_websockets:
        await queue.put(message)

@collect_websocket
async def sending(queue=None):
    while True:
        data = await queue.get()
        await websocket.send_json(data)

async def receiving():
    while True:
        data = await websocket.receive_json()
        print(data)
        await broadcast(data)

async def ws_loop():
    producer = asyncio.create_task(sending())
    consumer = asyncio.create_task(receiving())
    await asyncio.gather(producer, consumer)
