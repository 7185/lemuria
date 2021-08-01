#!/usr/bin/env python
from quart import json, current_app

class World:
    def __init__(self, world_id):
        self.world_id = world_id
        self._resolved = False
        self._name = None
        self._welcome = None
        self._path = None
        self._entry = '0N 0W'
        self._objects = None
        self._elev = None

    async def _resolve(self):
        if not self._resolved:
            conn = await current_app.engine.connect()
            result = await conn.execute(f"select * from world where id = {self.world_id}")
            data = await result.first()
            if data[2] is not None:
                world_data = json.loads(data[2])
                self._name = data[1]
                self._welcome = world_data['welcome']
                self._path = world_data['path']
                if 'entry' in world_data:
                    self._entry = world_data['entry'] or '0N 0W'
                self._objects = []
                result = await conn.execute(f"select * from prop where wid = {self.world_id}")
                for prop in await result.fetchall():
                    self._objects.append(list(prop)[3:13])
                try:
                    self._elev = self.elev_dump()
                except FileNotFoundError:
                    pass
            self._resolved = True

    @property
    async def name(self):
        await self._resolve()
        return self._name

    async def to_dict(self):
        return {
            'id': self.world_id,
            'name': await self.name,
            'welcome': self._welcome,
            'path': self._path,
            'entry': self._entry,
            'objects': self._objects,
            'elev': self._elev
        }

    @classmethod
    async def get_list(cls):
        world_list = []
        conn = await current_app.engine.connect()
        result = await conn.execute("select id, name from world")
        for world in await result.fetchall():
            world_list.append({'id': world[0], 'name': world[1]})
        return world_list

    def elev_dump(self):
        with open(f"elev{self._name.lower()}.txt", 'r', encoding='ISO-8859-1') as f:
            elev = {}
            for l in f:
                s = l.strip().split(' ')
                if s[0] == 'elevdump':
                    continue
                if (int(s[0]), int(s[1])) not in elev:
                    elev[(int(s[0]), int(s[1]))] = []
                elev[(int(s[0]), int(s[1]))].append({
                    'node': (int(s[2]), int(s[3])),
                    'node_size': int(s[4]),
                    'textures': [int(x) for x in s[7:7 + int(s[5])]],
                    'elevs': [int(x) for x in s[7 + int(s[5]):7 + int(s[5]) + int(s[6])]]})
        d = {}
        for p, nodes in elev.items():
            x_page = 128 * p[0]
            z_page = 128 * p[1]
            for n in nodes:
                if f"{x_page}_{z_page}" not in d:
                    d[f"{x_page}_{z_page}"] = {}
                # ignore big nodes and nodes with few elevs for now
                if n['node_size'] == 4 and len(n['elevs']) > 1:
                    size = n['node_size'] * 2
                    x_node = n['node'][0]
                    z_node = n['node'][1]
                    for i in range(size):
                        row = i * 128
                        for j in range(size):
                            if n['elevs'][size * i + j] != 0:
                                d[f"{x_page}_{z_page}"][row + j + x_node + z_node * 128] = n['elevs'][size * i + j]
        return d
