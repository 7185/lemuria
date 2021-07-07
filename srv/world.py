#!/usr/bin/env python
from quart import json, g
from app import app

class World:
    def __init__(self, world_id):
        self.world_id = world_id
        self._resolved = False
        self._name = None
        self._avatars = None
        self._welcome = None
        self._path = None
        self._objects = None

    async def _resolve(self):
        if not self._resolved:
            conn = await app.engine.connect()
            result = await conn.execute(f"select * from world where id = {self.world_id}")
            data = await result.first()
            if data[2] is not None:
                d = json.loads(data[2])
                self._name = data[1]
                self._avatars = d['avatars']
                self._welcome = d['welcome']
                self._path = d['path']
                self._objects = []
                result = await conn.execute(f"select * from prop where wid = {self.world_id}")
                for l in await result.fetchall():
                    self._objects.append(list(l)[3:10])
            self._resolved = True
    
    @property
    async def name(self):
        await self._resolve()
        return self._name

    async def to_dict(self):
        return {
            'id': self.world_id,
            'name': await self.name,
            'avatars': self._avatars,
            'welcome': self._welcome,
            'path': self._path,
            'objects': self._objects
        }
