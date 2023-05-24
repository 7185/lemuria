#!/usr/bin/env python3
# encoding: utf-8
"""Easily create ../app.db and import atdump and propdump"""

import asyncio
from db_tools import import_world

asyncio.run(import_world('../dumps/atlemuria.txt', '../dumps/proplemuria.txt'))
