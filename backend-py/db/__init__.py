#!/usr/bin/env python
"""
Utility functions for working with a database using Prisma ORM
"""

from functools import wraps
from prisma import Prisma

db = Prisma()

def db_required(func):
    """
    Decorator function to ensure the database connection is established before calling the decorated
    function.

    Args:
        func (callable): The function to be decorated.

    Returns:
        callable: The decorated function.
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        if not db.is_connected():
            await db.connect()
        return await func(*args, **kwargs)
    return wrapper
