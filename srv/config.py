#!/usr/bin/env python
class Config(object):
    STATIC_PATH = 'static'
    DEBUG = True
    DB_FILE = 'app.db'
    QUART_AUTH_COOKIE_SECURE = False
    QUART_AUTH_COOKIE_HTTP_ONLY = False
    SECRET_KEY = '**changeme**'
    POSITION_UPDATE_TICK = 200 / 1e3