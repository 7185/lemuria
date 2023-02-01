#!/usr/bin/env python
"""World module"""

import aiofiles
import contextlib
from quart import json, current_app
from user.model import authorized_users, broadcast_userlist

class World:
    def __init__(self, world_id):
        self.world_id = world_id
        self._resolved = False
        self._name = None
        self._welcome = None
        self._path = None
        self._skybox = None
        self._sky_color = {"top": [0, 0, 0], "north": [0, 0, 0], "east": [0, 0, 0],
                           "south": [0, 0, 0], "west": [0, 0, 0], "bottom": [0, 0, 0]}
        self._entry = '0N 0W'
        self._objects = None
        self._terrain = False
        self._elev = None

    async def _resolve(self):
        if self._resolved:
            return

        conn = current_app.engine
        await conn.connect()

        data = await conn.fetch_one(f"select * from world where id = {self.world_id}")

        if data[2] is not None:
            world_data = json.loads(data[2])
            self._name = data[1]
            self._welcome = world_data['welcome']
            self._path = world_data['path']

            if 'sky_color' in world_data:
                self._sky_color = world_data['sky_color']

            if 'skybox' in world_data:
                self._skybox = world_data['skybox']

            if 'entry' in world_data:
                self._entry = world_data['entry'] or '0N 0W'

            if 'enable_terrain' in world_data:
                self._terrain = world_data['enable_terrain']

            with contextlib.suppress(FileNotFoundError):
                self._elev = await self.build_elev()

            self._resolved = True

        await conn.disconnect()

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
            'sky_color': self._sky_color,
            'skybox': self._skybox,
            'entry': self._entry,
            'terrain': self._terrain,
            'elev': self._elev
        }

    # Having a 'None' value on one of those coordinate criterias means no bound will be applied when querying all objects
    async def props(self, min_x = None, max_x = None, min_y = None, max_y = None, min_z = None, max_z = None):
        conn = current_app.engine
        await conn.connect()

        # Build the base query
        query = f"SELECT * FROM prop WHERE wid = {self.world_id}"

        # Build the WHERE clause
        where_clauses = [
            f"x >= {min_x}" if min_x is not None else None,
            f"x < {max_x}" if max_x is not None else None,
            f"y >= {min_y}" if min_y is not None else None,
            f"y < {max_y}" if max_y is not None else None,
            f"z >= {min_z}" if min_z is not None else None,
            f"z < {max_z}" if max_z is not None else None
        ]

        # Remove None values from the list of where clauses and add the WHERE clause to the query if necessary
        if where_clauses := [clause for clause in where_clauses if clause is not None]:
            query += " AND " + " AND ".join(where_clauses)

        props = [list(prop)[3:13] for prop in await conn.fetch_all(query)]

        await conn.disconnect()

        return {'entries': props}

    @classmethod
    async def get_list(cls):
        conn = current_app.engine
        await conn.connect()

        world_list = [
            {
                'id': world[0],
                'name': world[1],
                'users': len([u for u in authorized_users if u.connected and u.world == world[0]])
            }
            for world in await conn.fetch_all("select id, name from world")
        ]
        await conn.disconnect()
        return world_list

    async def parse_elev_dump(self):
        elev = {}
        async with aiofiles.open(f"dumps/elev{self._name.lower()}.txt", 'r', encoding='ISO-8859-1') as f:
            async for l in f:
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
        return elev

    async def build_elev(self):
        d = {}
        for p, nodes in (await self.parse_elev_dump()).items():
            x_page = 128 * p[0]
            z_page = 128 * p[1]
            for n in nodes:
                if len(n['textures']) == 1:
                    n['textures'] = 64 * n['textures']
                if f"{x_page}_{z_page}" not in d:
                    # new page
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
                                d[f"{x_page}_{z_page}"][row + j + x_node + z_node * 128] = (n['elevs'][size * i + j],
                                                                                            n['textures'][size * i + j])
        return d
