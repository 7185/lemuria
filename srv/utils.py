#!/usr/bin/env python
import asyncio
from typing import Callable
from contextlib import suppress

class Timer:
    def __init__(self, timeout: int, callback: Callable) -> None:
        self._timeout = timeout
        self._callback = callback
        self._task = None

    async def start(self) -> None:
        await asyncio.sleep(self._timeout)
        self._task = asyncio.ensure_future(self._callback())

    async def cancel(self) -> None:
        if self._task and not self._task.cancelled():
            self._task.cancel()
            with suppress(asyncio.CancelledError):
                await self._task