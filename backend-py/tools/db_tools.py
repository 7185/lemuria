#!/usr/bin/env python
"""
Database import and export tools module
"""

import json
import aiofiles
from db import db, db_required

# atdump v1
world_attr = {
    0: 'name',
    3: 'path',
    11: 'light.fog.color.r',
    12: 'light.fog.color.g',
    13: 'light.fog.color.b',
    25: 'welcome',
    41: 'light.dir.x',
    42: 'light.dir.y',
    43: 'light.dir.z',
    44: 'light.dir_color.r',
    45: 'light.dir_color.g',
    46: 'light.dir_color.b',
    47: 'light.amb_color.r',
    48: 'light.amb_color.g',
    49: 'light.amb_color.b',
    51: 'light.fog.enabled',
    52: 'light.fog.min',
    53: 'light.fog.max',
    61: 'sky.skybox',
    64: 'keywords',
    65: 'terrain.enabled',
    69: 'entry',
    70: 'sky.top_color.r',
    71: 'sky.top_color.g',
    72: 'sky.top_color.b',
    73: 'sky.north_color.r',
    74: 'sky.north_color.g',
    75: 'sky.north_color.b',
    76: 'sky.east_color.r',
    77: 'sky.east_color.g',
    78: 'sky.east_color.b',
    79: 'sky.south_color.r',
    80: 'sky.south_color.g',
    81: 'sky.south_color.b',
    82: 'sky.west_color.r',
    83: 'sky.west_color.g',
    84: 'sky.west_color.b',
    85: 'sky.bottom_color.r',
    86: 'sky.bottom_color.g',
    87: 'sky.bottom_color.b',
    111: 'water.texture_top',
    112: 'water.opacity',
    113: 'water.color.r',
    114: 'water.color.g',
    115: 'water.color.b',
    116: 'water.offset',
    120: 'water.texture_bottom',
    123: 'water.enabled',
    130: 'terrain.ambient',
    131: 'terrain.diffuse',
    132: 'water.under_view',
    141: 'terrain.offset'
}


async def load_atdump(file_path):
    """
    Asynchronously load data from an atdump file.

    Args:
        file_path (str): The path to the atdump file.

    Yields:
        tuple: A tuple containing the integer value and the stripped string value.
    """
    async with aiofiles.open(file_path, 'r', encoding='windows-1252') as file:
        async for line in file:
            parts = line.split(' ', 1)
            if parts[0] == 'atdump':
                continue
            yield (int(parts[0]), parts[1].strip())


async def load_elevdump(file_path):
    """
    Asynchronously load data from an elevdump file.

    Args:
        file_path (str): The path to the elevdump file.

    Yields:
        list: A list containing extracted integer values from the file.
    """
    async with aiofiles.open(file_path, 'r', encoding='windows-1252') as file:
        async for line in file:
            parts = line.split()
            if parts[0] == 'elevdump':
                continue
            yield [
                int(parts[0]), int(parts[1]), int(parts[2]), int(parts[3]), int(parts[4]),
                list(map(int, parts[7:7 + int(parts[5])])),
                list(map(int, parts[7 + int(parts[5]):]))
            ]


async def load_propdump(file_path):
    """
    Asynchronously load data from a propdump file.

    Args:
        file_path (str): The path to the propdump file.

    Yields:
        list: A list containing extracted integer values and slices from the file.
    """
    async with aiofiles.open(file_path, 'r', encoding='windows-1252') as file:
        async for line in file:
            line = (line.encode('windows-1252')
                        .replace(b'\x80\x7f', b'\r\n')
                        .replace(b'\x7f', b'\n')
                        .decode('windows-1252'))
            parts = line.split(' ', 11)
            if parts[0] == 'propdump':
                continue
            data = parts[11]
            obj_len = int(parts[8])
            desc_len = int(parts[9])
            act_len = int(parts[10])
            yield [
                int(parts[1]),
                data[:obj_len],
                int(parts[2]),
                int(parts[3]),
                int(parts[4]),
                int(parts[6]),
                int(parts[5]),
                int(parts[7]),
                data[obj_len:obj_len + desc_len] or None,
                data[obj_len + desc_len:obj_len + desc_len + act_len] or None
            ]


@db_required
async def save_elevdump(world_name, file):    
    async with aiofiles.open(file, 'w', encoding='windows-1252') as f:
        await f.write('elevdump version 1\r\n')
        for elev in await db.query_raw((
            "select page_x, page_z, node_x, node_z, radius, textures, heights "
            "from elev where wid = (SELECT id FROM world WHERE LOWER(name) = "
            f"'{world_name.lower()}')"
        )):
            await f.write((
                f"{elev['page_x']} {elev['page_z']} {elev['node_x']} {elev['node_z']} "
                f"{elev['radius']} {len(elev['textures'].split(' '))} "
                f"{len(elev['heights'].split(' '))} {elev['textures']} {elev['heights']}\r\n"
            ))


@db_required
async def save_propdump(world_name, file):
    async with aiofiles.open(file, 'w', encoding='windows-1252') as f:
        await f.write('propdump version 3\r\n')
        for prop in await db.query_raw((
            "select uid, date, x, y, z, ya, pi, ro, LENGTH(name), coalesce(length(desc), 0), "
            "coalesce(length(act), 0), name || coalesce(desc, '') || coalesce(act, '') "
            "from prop where wid = (SELECT id FROM world WHERE LOWER(name) = "
            f"'{world_name.lower()}')"
        )):
            await f.write(f"{' '.join(str(v) for v in prop.values())}\r\n")


@db_required
async def save_atdump(world_name, file):
    world = await db.query_raw(
        f"SELECT * FROM world WHERE LOWER(name) = '{world_name.lower()}'"
    )
    if not world:
        print('World not found')
        return

    attr_dict = json.loads(world[0]['data'])

    reverse_world_attr = {value: key for key, value in world_attr.items()}

    lines = [
        (reverse_world_attr.get(key), value) for key, value in _flatten_dict(attr_dict).items()
    ]
    # Sort the lines based on the numeric keys
    lines.sort(key=lambda x: x[0])

    # Extract the sorted lines including the numeric keys
    sorted_lines = [f"{num} {value}" for num, value in lines]
    async with aiofiles.open(file, 'w', encoding='windows-1252') as f:
        await f.write('atdump version 1\r\n')
        for line in sorted_lines:
            await f.write(f"{line}\r\n")


async def parse_atdump(attr_file):
    # Read the file and populate the JSON structure
    attr_dict = {}

    async for entry in load_atdump(attr_file):
        key, value = entry[0], entry[1]
        path = world_attr.get(key)
        if path is None:
            continue
        # Set the value in the JSON structure using the JSON path
        keys = path.split(".")
        target = attr_dict
        for key in keys[:-1]:
            if key not in target:
                target[key] = [0, 0, 0] if key.endswith('color') else {}
            target = target[key]
        if keys[-1] == "enabled":
            target[keys[-1]] = value == "Y"
        elif keys[-1] in "rgb":
            color_index = "rgb".index(keys[-1])
            target[color_index] = int(value)
        else:
            try:
                target[keys[-1]] = int(value)
            except ValueError:
                try:
                    target[keys[-1]] = float(value)
                except ValueError:
                    target[keys[-1]] = value
    return attr_dict


@db_required
async def import_world(world_name, path='../dumps'):
    admin = await db.user.find_first(
        where={
            'name': 'admin'
        }
    )
    if admin is None:
        admin = await db.user.create({'name': 'admin', 'password': '', 'email': ''})
    attr_dict = await parse_atdump(f'{path}/at{world_name}.txt')

    world = await db.query_raw(
        f"SELECT * FROM world WHERE LOWER(name) = '{attr_dict['name'].lower()}'"
    )

    if not world:
        world = await db.world.create({'name': attr_dict['name'],
                                       'data': json.dumps(attr_dict)})
    else:
        world = await db.world.find_first(where={'id': world[0]['id']})
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

    await db.elev.delete_many(where={
        'wid': world.id
    })

    await db.query_raw('BEGIN TRANSACTION')

    async for e in load_elevdump(f'{path}/elev{world_name}.txt'):
        await db.query_raw(
            ('INSERT INTO elev (wid, page_x, page_z, node_x, node_z, radius, textures, heights) '
             'VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
            world.id, e[0], e[1], e[2], e[3], e[4], ' '.join(str(n) for n in e[5]),
            ' '.join(str(n) for n in e[6])
        )

    async for o in load_propdump(f'{path}/prop{world_name}.txt'):
        await db.query_raw(
            ('INSERT INTO prop (wid, uid, date, name, x, y, z, pi, ya, ro, desc, act) '
             'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
            world.id, admin.id, o[0], o[1], o[2], o[3], o[4], o[5], o[6], o[7], o[8], o[9]
        )

    await db.query_raw('COMMIT')


async def export_world(world_name, path='../dumps'):
    """
    Asynchronously export world data in different dump formats.

    Args:
        world_name (str): The name of the world to be exported.
        path (str, optional): The path where the dump files will be saved. Defaults to '../dumps'.
    """
    await save_atdump(world_name, f'{path}/export_at{world_name}.txt')
    await save_elevdump(world_name, f'{path}/export_elev{world_name}.txt')
    await save_propdump(world_name, f'{path}/export_prop{world_name}.txt')


def _flatten_dict_gen(dictionary, parent_key, separator):
    """
    Generator function to flatten a nested dictionary.

    Args:
        dictionary (dict): The input dictionary to be flattened.
        parent_key (str): The prefix for the current key.
        separator (str): Separator to be used between keys.

    Yields:
        tuple: A tuple containing the flattened key and its value.
    """
    for key, value in dictionary.items():
        new_key = parent_key + separator + key if parent_key else key
        if isinstance(value, list):
            value = {'r': value[0], 'g': value[1], 'b': value[2]}
        if isinstance(value, dict):
            yield from _flatten_dict(value, new_key, separator).items()
        else:
            if isinstance(value, bool):
                value = "Y" if value else "N"
            yield new_key, value


def _flatten_dict(nested_dict: dict, parent_key: str = '', separator: str = '.'):
    """
    Flatten a nested dictionary.

    Args:
        nested_dict (dict): The input dictionary to be flattened.
        parent_key (str, optional): The prefix for the current key. Defaults to an empty string.
        separator (str, optional): Separator to be used between keys. Defaults to '.'.

    Returns:
        dict: A new dictionary with flattened keys and their corresponding values.
    """
    return dict(_flatten_dict_gen(nested_dict, parent_key, separator))
