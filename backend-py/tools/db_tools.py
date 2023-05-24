#!/usr/bin/env python
"""Database tools module"""

import json
import aiofiles
from db import db, db_required

# atdump v1
world_attr = {
    0: 'name',
    3: 'path',
    11: 'fog_color_r',
    12: 'fog_color_g',
    13: 'fog_color_b',
    25: 'welcome',
    41: 'light_dir_x',
    42: 'light_dir_y',
    43: 'light_dir_z',
    44: 'dir_light_r',
    45: 'dir_light_g',
    46: 'dir_light_b',
    47: 'amb_light_r',
    48: 'amb_light_g',
    49: 'amb_light_b',
    51: 'enable_fog',
    52: 'fog_min',
    53: 'fog_max',
    61: 'skybox',
    64: 'keywords',
    65: 'enable_terrain',
    69: 'entry',
    70: 'sky_color_top_r',
    71: 'sky_color_top_g',
    72: 'sky_color_top_b',
    73: 'sky_color_north_r',
    74: 'sky_color_north_g',
    75: 'sky_color_north_b',
    76: 'sky_color_east_r',
    77: 'sky_color_east_g',
    78: 'sky_color_east_b',
    79: 'sky_color_south_r',
    80: 'sky_color_south_g',
    81: 'sky_color_south_b',
    82: 'sky_color_west_r',
    83: 'sky_color_west_g',
    84: 'sky_color_west_b',
    85: 'sky_color_bottom_r',
    86: 'sky_color_bottom_g',
    87: 'sky_color_bottom_b'
}


async def attr_dump(file):
    async with aiofiles.open(file, 'r', encoding='windows-1252') as f:
        async for l in f:
            s = l.split(' ', 1)
            if s[0] == 'atdump':
                continue
            yield (int(s[0]), s[1].strip())


async def prop_dump(file):
    async with aiofiles.open(file, 'r', encoding='windows-1252') as f:
        async for l in f:
            l = l.encode('windows-1252').replace(b'\x80\x7f', b'\r\n').replace(b'\x7f', b'\n').decode('windows-1252')
            s = l.split(' ', 11)
            if s[0] == 'propdump':
                continue
            data = s[11]
            obj_len = int(s[8])
            # uncomment for reconstructed dumps
            desc_len = int(s[9]) - data[obj_len:obj_len + int(s[9])].count('\n')
            act_len = int(s[10]) + data.count('\n') - 1
            yield [int(s[1]), data[:obj_len], int(s[2]), int(s[3]), int(s[4]),
                   int(s[6]), int(s[5]), int(s[7]),
                   data[obj_len:obj_len + desc_len] or None,
                   data[obj_len + desc_len:obj_len + desc_len + act_len] or None]


async def parse_atdump(attr_file):
    attr_dict = {}

    async for entry in attr_dump(attr_file):
        attr_key = world_attr.get(entry[0])
        if attr_key is not None:
            if attr_key.startswith('sky_color'):
                attr_dict.setdefault('sky_color', {}).setdefault(attr_key.split('_')[2], [0, 0, 0])['rgb'.index(attr_key.split('_')[3])] = int(entry[1])
            elif attr_key == 'enable_terrain':
                attr_dict[attr_key] = entry[1] == 'Y'
            elif attr_key == 'enable_fog':
                attr_dict[attr_key] = entry[1] == 'Y'
            elif attr_key.endswith('_min') or attr_key.endswith('_max'):
                attr_dict[attr_key] = int(entry[1])
            elif attr_key.startswith('dir_light'):
                attr_dict.setdefault('dirlight_color', [0, 0, 0])['rgb'.index(attr_key.split('_')[2])] = int(entry[1])
            elif attr_key.startswith('amb_light'):
                attr_dict.setdefault('amblight_color', [0, 0, 0])['rgb'.index(attr_key.split('_')[2])] = int(entry[1])
            elif attr_key.startswith('light_dir'):
                attr_dict.setdefault('light_dir', [0, 0, 0])['xyz'.index(attr_key.split('_')[2])] = float(entry[1])
            elif attr_key.startswith('fog_color_'):
                attr_dict.setdefault('fog_color', [0, 0, 0])['rgb'.index(attr_key.split('_')[2])] = int(entry[1])
            else:
                attr_dict[attr_key] = entry[1]
    return attr_dict

@db_required
async def import_world(attr_file, prop_file):
    admin = await db.user.find_first(
        where={
            'name': 'admin'
        }
    )
    if admin is None:
        admin = await db.user.create({'name': 'admin', 'password': '', 'email': ''})
    attr_dict = await parse_atdump(attr_file)

    world = await db.query_raw(
        f"SELECT * FROM world WHERE LOWER(name) = '{attr_dict['name'].lower()}'"
    )

    if not world:
        world = await db.world.create({'name': attr_dict['name'],
                                       'data': json.dumps(attr_dict)})
    else:
        world = await db.world.find_first(where= {'id': world[0]['id']})
        await db.world.update(
            where={
                'id': world.id
            },
            data={
                'name': attr_dict['name'],
                'data': json.dumps(attr_dict)
            }
        )
    await db.prop.delete_many(where={
         'wid': world.id
    })

    await db.query_raw('BEGIN TRANSACTION')

    async for o in prop_dump(prop_file):
        await db.query_raw(
            'INSERT INTO prop (wid, uid, date, name, x, y, z, pi, ya, ro, desc, act) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            world.id, admin.id, o[0], o[1], o[2], o[3], o[4], o[5], o[6], o[7], o[8], o[9]
        )

    await db.query_raw('COMMIT')
