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
        self._terrain_offset = 0
        self._terrain_ambient = 0.2
        self._terrain_diffuse = 1
        self._water = False
        self._water_color = [0, 0, 255]
        self._water_offset = -1
        self._water_texture_top = ''
        self._water_texture_bottom = ''
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
            self._terrain_offset = world_data.get('terrain_offset', self._terrain_offset)
            self._terrain_ambient = world_data.get('terrain_ambient', self._terrain_ambient)
            self._terrain_diffuse = world_data.get('terrain_diffuse', self._terrain_diffuse)
            self._fog = world_data.get('enable_fog', self._fog)
            self._fog_color = world_data.get('fog_color', self._fog_color)
            self._fog_min = world_data.get('fog_min', self._fog_min)
            self._fog_max = world_data.get('fog_max', self._fog_max)
            self._water = world_data.get('enable_water', self._water)
            self._water_color = world_data.get('water_color', self._water_color)
            self._water_offset = world_data.get('water_offset', self._water_offset)
            self._water_texture_top = world_data.get('water_texture_top', self._water_texture_top)
            self._water_texture_bottom = world_data.get('water_texture_bottom', self._water_texture_bottom)
            self._amblight_color = world_data.get('amblight_color', self._amblight_color)
            self._dirlight_color = world_data.get('dirlight_color', self._dirlight_color)
            self._light_dir = world_data.get('light_dir', self._light_dir)

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
            'sky_color': self._sky_color,
            'skybox': self._skybox,
            'entry': self._entry,
            'terrain': self._terrain,
            'terrain_offset': self._terrain_offset,
            'terrain_ambient': self._terrain_ambient,
            'terrain_diffuse': self._terrain_diffuse,
            'elev': self._elev,
            'amblight_color': self._amblight_color,
            'dirlight_color': self._dirlight_color,
            'light_dir': self._light_dir,
            'fog': self._fog,
            'fog_color': self._fog_color,
            'fog_min': self._fog_min,
            'fog_max': self._fog_max,
            'water': self._water,
            'water_color': self._water_color,
            'water_offset': self._water_offset,
            'water_texture_top': self._water_texture_top,
            'water_texture_bottom': self._water_texture_bottom
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
