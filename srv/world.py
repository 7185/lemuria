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
        self._entry = '0N 0W'
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
                if 'entry' in d:
                    self._entry = d['entry'] or '0N 0W'
                self._objects = []
                result = await conn.execute(f"select * from prop where wid = {self.world_id}")
                for l in await result.fetchall():
                    self._objects.append(list(l)[3:13])
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
            'entry': self._entry,
            'objects': self._objects
        }

    @classmethod
    async def get_list(self):
        w = []
        conn = await app.engine.connect()
        result = await conn.execute(f"select id, name from world")
        for l in await result.fetchall():
            w.append({'id': l[0], 'name': l[1]})
        return w

