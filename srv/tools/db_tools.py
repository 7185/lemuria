#!/usr/bin/env python
"""Database tools module"""

import json
import trio
from sqlalchemy_aio import TRIO_STRATEGY
from sqlalchemy import create_engine, MetaData, Table, Column, Integer, Text
from sqlalchemy.schema import CreateTable

engine = create_engine('sqlite:///../app.db', strategy=TRIO_STRATEGY)
metadata = MetaData()

world_attr = {
    0: 'name',
    3: 'path',
    25: 'welcome',
    61: 'skybox',
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

user = Table(
    'user', metadata,
    Column('id', Integer, primary_key=True),
    Column('name', Text),
    Column('password', Text),
    Column('email', Text)
)
world = Table(
    'world', metadata,
    Column('id', Integer, primary_key=True),
    Column('name', Text),
    Column('data', Text),
)

prop = Table(
    'prop', metadata,
    Column('id', Integer, primary_key=True),
    Column('wid', Integer),
    Column('uid', Integer),
    Column('date', Integer),
    Column('name', Text),
    Column('x', Integer),
    Column('y', Integer),
    Column('z', Integer),
    Column('pi', Integer),
    Column('ya', Integer),
    Column('ro', Integer),
    Column('desc', Text),
    Column('act', Text)
)


async def attr_dump(file):
    async with await trio.open_file(file, 'r', encoding='ISO-8859-1') as f:
        async for l in f:
            s = l.split(' ', 1)
            if s[0] == 'atdump':
                continue
            yield (int(s[0]), s[1].strip())


async def prop_dump(file):
    async with await trio.open_file(file, 'r', encoding='ISO-8859-1') as f:
        async for l in f:
            s = l.split(' ', 11)
            if s[0] == 'propdump':
                continue
            data = s[11]
            obj_len = int(s[8])
            desc_len = int(s[9])
            act_len = int(s[10])
            yield [int(s[1]), data[:obj_len], int(s[2]), int(s[3]), int(s[4]),
                   int(s[6]), int(s[5]), int(s[7]),
                   data[obj_len:obj_len + desc_len] or None,
                   data[obj_len + desc_len:obj_len + desc_len + act_len] or None]


async def init_db():
    await engine.execute(CreateTable(user))
    await engine.execute(CreateTable(world))
    await engine.execute(CreateTable(prop))

    conn = await engine.connect()
    await conn.execute(user.insert().values(name='admin', password='', email=''))


async def import_world(attr_file, prop_file):
    conn = await engine.connect()
    result = await conn.execute("select id from user where lower(name) = 'admin'")
    data = await result.first()
    if data is None:
        print("Create admin user first")
        return
    admin_id = data[0]
    attr_dict = {}
    async for entry in attr_dump(attr_file):
        if entry[0] in world_attr:
            if world_attr[entry[0]].startswith('sky_color'):
                # TODO
                pass
            else:
                attr_dict[world_attr[entry[0]]] = entry[1]

    w_query = f"select id from world where lower(name) = '{attr_dict['name'].lower()}'"
    result = await conn.execute(w_query)
    data = await result.first()
    if data is None:
        await conn.execute(world.insert().values(name=attr_dict['name'],
                                                 data=json.dumps(attr_dict)))
        result = await conn.execute(w_query)
        data = await result.first()
    world_id = data[0]
    await conn.execute(prop.delete().where(prop.c.wid==world_id))
    trans = await conn.begin()
    async for o in prop_dump(prop_file):
        await conn.execute(prop.insert().values(wid=world_id, uid=admin_id, date=o[0], name=o[1],
                                                x=o[2], y=o[3], z=o[4], pi=o[5], ya=o[6], ro=o[7],
                                                desc=o[8], act=o[9]))
    await trans.commit()
