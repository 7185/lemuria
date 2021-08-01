#!/usr/bin/env python
import trio
import json
from sqlalchemy_aio import TRIO_STRATEGY
from sqlalchemy import create_engine, MetaData, Table, Column, Integer, Text
from sqlalchemy.schema import CreateTable

engine = create_engine(f'sqlite:///../app.db', strategy=TRIO_STRATEGY)
metadata = MetaData()

world_attr = {
    0: 'name',
    3: 'path',
    25: 'welcome',
    69: 'entry'
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


def attr_dump(file):
    with open(file, 'r', encoding='ISO-8859-1') as f:
        for l in f:
            s = l.split(' ', 1)
            if s[0] == 'atdump':
                continue
            yield (int(s[0]), s[1].strip())


def prop_dump(file):
    with open(file, 'r', encoding='ISO-8859-1') as f:
        for l in f:
            s = l.split(' ', 11)
            if s[0] == 'propdump':
                continue
            data = s[11]
            obj_len = int(s[8])
            desc_len = int(s[9])
            act_len = int(s[10])
            yield [int(s[1]), data[:obj_len], int(s[2]), int(s[3]), int(s[4]), int(s[6]), int(s[5]), int(s[7]),
                data[obj_len:obj_len + desc_len] or None, data[obj_len + desc_len:obj_len + desc_len + act_len] or None]


async def init_db():
    await engine.execute(CreateTable(user))
    await engine.execute(CreateTable(world))
    await engine.execute(CreateTable(prop))

    conn = await engine.connect()
    await conn.execute(user.insert().values(name='admin', password='', email=''))


async def import_world(attr_file, prop_file):
    conn = await engine.connect()
    result = await conn.execute(f"select id from user where lower(name) = 'admin'")
    data = await result.first()
    if data is None:
        print("Create admin user first")
        return
    admin_id = data[0]
    attr_dict = {}
    for e in attr_dump(attr_file):
        if e[0] in world_attr:
            attr_dict[world_attr[e[0]]] = e[1]

    w_query = f"select id from world where lower(name) = '{attr_dict['name'].lower()}'"
    result = await conn.execute(w_query)
    data = await result.first()
    if data is None:
        await conn.execute(world.insert().values(name=attr_dict['name'], data=json.dumps(attr_dict)))
        result = await conn.execute(w_query)
        data = await result.first()
    world_id = data[0]
    await conn.execute(prop.delete().where(prop.c.wid==world_id))
    trans = await conn.begin()
    for o in prop_dump(prop_file):
        await conn.execute(prop.insert().values(wid=world_id, uid=admin_id, date=o[0], name=o[1],
                                                x=o[2], y=o[3], z=o[4], pi=o[5], ya=o[6], ro=o[7],
                                                desc=o[8], act=o[9]))
    await trans.commit()
