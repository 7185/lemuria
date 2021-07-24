#!/usr/bin/env python3
# encoding: utf-8

"""Easily create ../app.db and import ../lemuria.json"""

import trio
from db_tools import init_db
trio.run(init_db)
from db_tools import import_world
trio.run(import_world, '../atlemuria.txt', '../proplemuria.txt')