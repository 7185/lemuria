#!/usr/bin/env python
"""
Utility functions for working with a SQLite database using aiosqlite
"""

from contextlib import asynccontextmanager
from functools import wraps
import os
import aiosqlite

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS "world" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "data" TEXT
);

CREATE TABLE IF NOT EXISTS "user" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "prop" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wid" INTEGER NOT NULL,
    "uid" INTEGER NOT NULL,
    "date" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "z" INTEGER NOT NULL,
    "pi" INTEGER NOT NULL,
    "ya" INTEGER NOT NULL,
    "ro" INTEGER NOT NULL,
    "desc" TEXT,
    "act" TEXT,
    CONSTRAINT "prop_wid_fkey" FOREIGN KEY ("wid") REFERENCES "world" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "prop_uid_fkey" FOREIGN KEY ("uid") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "elev" (
    "wid" INTEGER NOT NULL,
    "page_x" INTEGER NOT NULL,
    "page_z" INTEGER NOT NULL,
    "node_x" INTEGER NOT NULL,
    "node_z" INTEGER NOT NULL,
    "radius" INTEGER NOT NULL,
    "textures" TEXT,
    "heights" TEXT,
    PRIMARY KEY ("wid", "page_x", "page_z", "node_x", "node_z"),
    CONSTRAINT "elev_wid_fkey" FOREIGN KEY ("wid") REFERENCES "world" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "prop_x_idx" ON "prop"("x");
CREATE INDEX IF NOT EXISTS "prop_z_idx" ON "prop"("z");
"""


def get_db_path() -> str:
    raw = os.environ.get('ADAPTER_URL') or os.environ.get('DATABASE_URL') or 'app.db'
    return raw.removeprefix('file:')


class Database:
    """Async SQLite wrapper around aiosqlite with parameterized queries."""

    def __init__(self):
        self._conn: aiosqlite.Connection | None = None

    def is_connected(self) -> bool:
        return self._conn is not None

    async def connect(self, db_path: str | None = None):
        if self._conn is not None:
            return
        path = db_path if db_path is not None else get_db_path()
        self._conn = await aiosqlite.connect(path)
        self._conn.row_factory = aiosqlite.Row
        await self._conn.execute('PRAGMA foreign_keys = ON')

    async def close(self):
        if self._conn is not None:
            await self._conn.close()
            self._conn = None

    async def init_schema(self):
        assert self._conn is not None
        await self._conn.executescript(SCHEMA_SQL)
        await self._conn.commit()

    async def ping(self):
        assert self._conn is not None
        async with self._conn.execute('SELECT 1') as cursor:
            await cursor.fetchone()

    async def fetchone(self, query: str, params: tuple = ()):
        assert self._conn is not None
        async with self._conn.execute(query, params) as cursor:
            return await cursor.fetchone()

    async def fetchall(self, query: str, params: tuple = ()):
        assert self._conn is not None
        async with self._conn.execute(query, params) as cursor:
            return await cursor.fetchall()

    async def execute(self, query: str, params: tuple = ()):
        assert self._conn is not None
        cursor = await self._conn.execute(query, params)
        return cursor

    async def executemany(self, query: str, seq_of_params):
        assert self._conn is not None
        await self._conn.executemany(query, seq_of_params)

    async def commit(self):
        assert self._conn is not None
        await self._conn.commit()

    @asynccontextmanager
    async def transaction(self):
        assert self._conn is not None
        try:
            yield self._conn
            await self._conn.commit()
        except Exception:
            await self._conn.rollback()
            raise


db = Database()


def db_required(func):
    """
    Decorator function to ensure the database connection is established before calling the decorated
    function.
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        if not db.is_connected():
            await db.connect()
        return await func(*args, **kwargs)
    return wrapper
