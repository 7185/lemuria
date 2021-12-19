#!/usr/bin/env python3
# encoding: utf-8
"""Easily create ../app.db and import ../lemuria.json"""

import asyncio
from db_tools import init_db
from db_tools import import_world

asyncio.run(init_db())
asyncio.run(import_world('../atlemuria.txt', '../proplemuria.txt'))
