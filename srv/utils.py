#!/usr/bin/env python
import trio
from quart import g
from typing import Callable
from contextlib import suppress

class Timer:
    def __init__(self, timeout: int, callback: Callable) -> None:
        self._timeout = timeout
        self._callback = callback
        self._task = None
        self._nursery = g.nursery

    async def start(self) -> None:
        self._nursery.start_soon(self._job)

    async def _job(self) -> None:
        await trio.sleep(self._timeout)
        self._nursery.start_soon(self._callback)
        self._nursery.start_soon(self._job)

    async def cancel(self) -> None:
        self._nursery.cancel_scope.cancel()