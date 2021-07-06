#!/usr/bin/env python
import trio
import json
from sqlalchemy_aio import TRIO_STRATEGY
from sqlalchemy import create_engine, MetaData, Table, Column, Integer, Text
from sqlalchemy.schema import CreateTable

engine = create_engine(f'sqlite:///../app.db', strategy=TRIO_STRATEGY)
metadata = MetaData()

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

async def init_db():
    await engine.execute(CreateTable(user))
    await engine.execute(CreateTable(world))
    await engine.execute(CreateTable(prop))

    conn = await engine.connect()
    await conn.execute(user.insert().values(name='admin', password='', email=''))
    await conn.execute(world.insert().values(name='Lemuria'))
    await conn.execute(world.insert().values(name='Tibsland'))

async def import_world(name):
    conn = await engine.connect()
    result = await conn.execute(f"select id from world where lower(name) = '{name.lower()}'")
    data = await result.first()
    wid = data[0]
    with open(f"../{name}.json") as f:
        w = json.load(f)
        objects = w['objects']
        del(w['name'])
        del(w['objects'])
        await conn.execute(world.update().where(world.c.id==wid).values(data=json.dumps(w)))
        for o in objects:
            await conn.execute(prop.insert().values(wid=wid, uid=1, name=o[0], x=o[1], y=o[2], z=o[3], pi=o[4], ya=o[5], ro=o[6]))

# trio.run(init_db)
