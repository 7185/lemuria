#!/usr/bin/env python
"""World module"""

import aiofiles
import contextlib
from quart import json, current_app
from db import db, db_required
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
        self._amblight_color = [255, 255, 255]
        self._dirlight_color = [255, 255, 255]
        self._light_dir = [-.8, -.5, -.2]
        self._fog = False
        self._fog_color = [0, 0, 127]
        self._fog_min = 0
        self._fog_max = 120
        self._entry = '0N 0W'
        self._objects = None
        self._terrain = False
        self._elev = None

    @db_required
    async def _resolve(self):
        if self._resolved:
            return

        world = await db.world.find_first(
            where={
                'id': self.world_id
            }
        )
        if world.data is not None:
            world_data = json.loads(world.data)
            self._name = world.name
            self._welcome = world_data['welcome']
            self._path = world_data['path']

            self._sky_color = world_data.get('sky_color', self._sky_color)
            self._skybox = world_data.get('skybox', self._skybox)
            self._entry = world_data.get('entry', '0N 0W')
            self._terrain = world_data.get('enable_terrain', self._terrain)
            self._fog = world_data.get('enable_fog', self._fog)
            self._fog_color = world_data.get('fog_color', self._fog_color)
            self._fog_min = world_data.get('fog_min', self._fog_min)
            self._fog_max = world_data.get('fog_max', self._fog_max)
            self._amblight_color = world_data.get('amblight_color', self._amblight_color)
            self._dirlight_color = world_data.get('dirlight_color', self._dirlight_color)
            self._light_dir = world_data.get('light_dir', self._light_dir)

            with contextlib.suppress(FileNotFoundError):
                self._elev = await self.build_elev()

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
            'sky_color': self._sky_color,
            'skybox': self._skybox,
            'entry': self._entry,
            'terrain': self._terrain,
            'elev': self._elev,
            'amblight_color': self._amblight_color,
            'dirlight_color': self._dirlight_color,
            'light_dir': self._light_dir,
            'fog': self._fog,
            'fog_color': self._fog_color,
            'fog_min': self._fog_min,
            'fog_max': self._fog_max
        }

    @db_required
    async def props(self, min_x = None, max_x = None, min_y = None, max_y = None, min_z = None, max_z = None):
        # Having a 'None' value on one of those coordinate criterias means no bound will be applied when querying all objects


        # Build the WHERE clause
        where_clauses = [
            {'x': {'gte': min_x}} if min_x is not None else None,
            {'x': {'lt': max_x}} if max_x is not None else None,
            {'y': {'gte': min_y}} if min_y is not None else None,
            {'y': {'lt': max_y}} if max_y is not None else None,
            {'z': {'gte': min_z}} if min_z is not None else None,
            {'z': {'lt': max_z}} if max_z is not None else None
        ]

        props = [
            [prop.date, prop.name, prop.x, prop.y, prop.z, prop.pi, prop.ya, prop.ro, prop.desc, prop.act]
            for prop in await db.prop.find_many(
                where={
                    'AND': [
                        {'wid': self.world_id},
                        {
                            'AND': [
                                clause
                                for clause in where_clauses
                                if clause is not None
                            ]
                        },
                    ]
                }
            )
        ]

        return {'entries': props}

    @classmethod
    @db_required
    async def get_list(cls):
        return [
            {
                'id': world.id,
                'name': world.name,
                'users': len([u for u in authorized_users if u.connected and u.world == world.id])
            }
            for world in await db.world.find_many()
        ]

    async def parse_elev_dump(self):
        elev = {}
        async with aiofiles.open(f"dumps/elev{self._name.lower()}.txt", 'r', encoding='ISO-8859-1') as f:
            async for line in f:
                parts = line.strip().split(' ')
                if parts[0] == 'elevdump':
                    continue
                coords = (int(parts[0]), int(parts[1]))
                if coords not in elev:
                    elev[coords] = []
                elev[coords].append({
                    'node': (int(parts[2]), int(parts[3])),
                    'node_size': int(parts[4]),
                    'textures': [int(x) for x in parts[7:7 + int(parts[5])]],
                    'elevs': [int(x) for x in parts[7 + int(parts[5]):7 + int(parts[5]) + int(parts[6])]]
                })
        return elev

    async def build_elev(self):
        elev_data = await self.parse_elev_dump()
        elev_pages = {}
        for coords, nodes in elev_data.items():
            x_page = 128 * coords[0]
            z_page = 128 * coords[1]
            if f"{x_page}_{z_page}" not in elev_pages:
                elev_pages[f"{x_page}_{z_page}"] = {}
            for node in nodes:
                if len(node['textures']) == 1:
                    node['textures'] = 64 * node['textures']
                # ignore big nodes and nodes with few elevs for now
                if len(node['elevs']) > 1:
                    size = node['node_size'] * 2
                    x_node, z_node = node['node']
                    for i in range(size):
                        row = i * 128
                        for j in range(size):
                            idx = size * i + j
                            if node['elevs'][idx] != 0:
                                elev_pages[f"{x_page}_{z_page}"][row + j + x_node + z_node * 128] = (
                                    node['elevs'][idx], node['textures'][idx]
                                )
        return elev_pages
