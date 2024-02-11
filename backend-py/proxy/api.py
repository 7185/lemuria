#!/usr/bin/env python
"""Proxy API routes"""

import httpx
from quart import Blueprint, current_app, request, Response

api_proxy = Blueprint('api_proxy', __name__, url_prefix='/api/v1/proxy')


@api_proxy.get('/archive')
async def media_archive():
    """Get media file from archive"""

    cache = current_app.cache
    url = request.args.get("url")
    date = request.args.get("date") or '199501'

    # Don't use the date in the cache key
    if (out := cache.get(f"U-{url}")) is not None:
        return ({'url': out}, 200) if out else ({}, 404)
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(
                f'https://archive.org/wayback/available?url={url}&timestamp={date}',
                follow_redirects=True,
                timeout=30
            )
        except Exception:
            return {}, 404
        if res.status_code == 200:
            try:
                out = res.json()['archived_snapshots']['closest']['url'].replace('/http', 'im_/http')
                cache.set(f"U-{url}", out)
                return {'url': out}, 200
            except Exception:
                cache.set(f"U-{url}", "")
                return {}, 404
        else:
            cache.set(f"U-{url}", "")

    return {}, 404


@api_proxy.get('/url')
async def media_proxy():
    """Proxy media file"""
    url = request.args.get("url")

    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(url, follow_redirects=True, timeout=30)
            if res.status_code == 200:
                return Response(res.content,
                                content_type=res.headers['content-type'],
                                status=res.status_code)
        except Exception:
            return {}, 404

    return {}, 404
