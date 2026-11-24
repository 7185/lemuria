#!/usr/bin/env python
"""World module"""

from quart import json
from db import db, db_required
from user.model import authorized_users

class World:
    """World class"""
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

    @db_required
    async def _resolve(self):
        if self._resolved:
            return

        world = await db.fetchone(
            'SELECT id, name, data FROM world WHERE id = ? LIMIT 1',
            (self.world_id,)
        )
        if world is not None and world['data'] is not None:
            world_data = json.loads(world['data'])
            self._name = world['name']
            self._welcome = world_data['welcome']
            self._path = world_data['path']
            self._entry = world_data.get('entry', self._entry)
            self._light.update(world_data.get('light', {}))
            self._sky.update(world_data.get('sky', {}))
            self._terrain.update(world_data.get('terrain', {}))
            self._water.update(world_data.get('water', {}))

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
            'water': self._water
        }

    @db_required
    async def props(self, min_x = None, max_x = None, min_y = None, max_y = None,
                    min_z = None, max_z = None):
        # Having a 'None' value on one of those coordinate criterias means no bound will be
        # applied when querying all objects
        conditions = ['wid = ?']
        params = [self.world_id]

        if min_x is not None:
            conditions.append('x >= ?')
            params.append(min_x)
        if max_x is not None:
            conditions.append('x < ?')
            params.append(max_x)
        if min_y is not None:
            conditions.append('y >= ?')
            params.append(min_y)
        if max_y is not None:
            conditions.append('y < ?')
            params.append(max_y)
        if min_z is not None:
            conditions.append('z >= ?')
            params.append(min_z)
        if max_z is not None:
            conditions.append('z < ?')
            params.append(max_z)

        query = (
            'SELECT id, date, name, x, y, z, pi, ya, ro, desc, act '
            f"FROM prop WHERE {' AND '.join(conditions)}"
        )
        rows = await db.fetchall(query, tuple(params))
        props = [
            [
                row['id'], row['date'], row['name'], row['x'], row['y'], row['z'],
                row['pi'], row['ya'], row['ro'], row['desc'], row['act']
            ]
            for row in rows
        ]

        return {'entries': props}

    @classmethod
    @db_required
    async def get_list(cls):
        worlds = await db.fetchall('SELECT id, name FROM world')
        return [
            {
                'id': world['id'],
                'name': world['name'],
                'users': len([u for u in authorized_users if u.connected and u.world == world['id']])
            }
            for world in worlds
        ]

    @db_required
    async def get_terrain_page(self, page_x, page_z):
        page = {}
        elevs = await db.fetchall(
            'SELECT node_x, node_z, radius, textures, heights FROM elev '
            'WHERE wid = ? AND page_x = ? AND page_z = ?',
            (self.world_id, page_x, page_z)
        )
        for elev in elevs:
            width = elev['radius'] * 2
            textures = [int(n) for n in (elev['textures'] or '').split(' ') if n]
            heights = [int(n) for n in (elev['heights'] or '').split(' ') if n]
            for i in range(width):
                row = i * 128
                for j in range(width):
                    index = width * i + j
                    texture = textures[index] if index < len(textures) else textures[0]
                    height = heights[index] if index < len(heights) else heights[0]
                    if texture == height == 0:
                        continue
                    cell = row + j + elev['node_x'] + elev['node_z'] * 128
                    page[cell] = [texture, height]
        return page
