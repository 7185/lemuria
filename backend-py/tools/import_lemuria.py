#!/usr/bin/env python
# encoding: utf-8
"""Easily create ../app.db and import atdump and propdump"""

import asyncio
from db import db
from db_tools import import_world


async def main():
    try:
        await import_world('lemuria')
    finally:
        await db.close()


asyncio.run(main())
