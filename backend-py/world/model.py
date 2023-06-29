#!/usr/bin/env python
"""World module"""

import contextlib
from quart import json
from db import db, db_required
from user.model import authorized_users

class World:
    def __init__(self, world_id):
        self.world_id = world_id
        self._resolved = False
        self._name = None
        self._welcome = None
        self._path = None
        self._entry = '0N 0W'
        self._light = {
            "fog": {
                "color": [0, 0, 127],
                "enabled": False,
                "min": 0, "max": 120
            },
            "dir_color": [255, 255, 255],
            "amb_color": [255, 255, 255],
            "dir": {"x": -.8, "y": -.5, "z":-.2}
        }
        self._sky = {
            "skybox": "",
            "top_color": [0, 0, 0], "north_color": [0, 0, 0], "east_color": [0, 0, 0],
            "south_color": [0, 0, 0], "west_color": [0, 0, 0], "bottom_color": [0, 0, 0]
        }
        self._terrain = {
            "enabled": False,
            "ambient": 0.2,
            "diffuse": 1,
            "offset": 0
        }
        self._water = {
            "texture_top": "",
            "opacity": 180,
            "color": [0, 0, 255],
            "offset": -1,
            "texture_bottom": "",
            "enabled": False,
            "under_view": 120
        }
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
            self._entry = world_data.get('entry', self._entry)
            self._light = world_data.get('light', self._light)
            self._sky = world_data.get('sky', self._sky)
            self._terrain = world_data.get('terrain', self._terrain)
            self._water = world_data.get('water', self._water)

            with contextlib.suppress(FileNotFoundError):
                self._elev = await self.get_elev()

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
            'light': self._light,
            'sky': self._sky,
            'terrain': self._terrain,
            'water': self._water,
            'elev': self._elev
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
            [prop.id, prop.date, prop.name, prop.x, prop.y, prop.z, prop.pi, prop.ya, prop.ro, prop.desc, prop.act]
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

    @db_required
    async def get_elev(self):
        data = {}
        for elev in await db.elev.find_many(where= {'wid': self.world_id}):
            page = f"{128 * elev.page_x}_{128 * elev.page_z}" 
            data.setdefault(page, {})
            width = elev.radius * 2
            textures = [int(n) for n in elev.textures.split(' ')] 
            heights = [int(n) for n in elev.heights.split(' ')]
            for i in range(width):
                row = i * 128
                for j in range(width):
                    index = width * i + j
                    texture = textures[index] if index < len(textures) else textures[0]
                    height = heights[index] if index < len(heights) else heights[0]
                    if texture == height == 0:
                        continue
                    cell = row + j + elev.node_x + elev.node_z * 128
                    data[page][cell] = [texture, height]
        return data
