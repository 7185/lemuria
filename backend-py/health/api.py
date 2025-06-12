#!/usr/bin/env python
"""Health API routes"""

from quart import Blueprint
from db import db, db_required

api_health = Blueprint('api_health', __name__, url_prefix='/')

@api_health.get('/livez')
async def check_liveness():
    return {
        'status': 'ok',
        'info': {'lemuria': {'status': 'up'}},
        'error': {},
        'details': {'lemuria': {'status': 'up'}}
    }, 200

@api_health.get('/readyz')
async def check_readiness():
    try:
        if not db.is_connected():
            await db.connect()
        return {
            'status': 'ok',
            'info': {'database': {'status': 'up'}},
            'error': {},
            'details': {'database': {'status': 'up'}}
        }, 200
    except Exception:
        return {
            'status': 'ko',
            'info': {'database': {'status': 'down'}},
            'error': {},
            'details': {'database': {'status': 'down'}}
        }, 503
