from functools import wraps
from prisma import Client

db = Client()


def db_required(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        if not db.is_connected():
            await db.connect()
        return await func(*args, **kwargs)
    return wrapper