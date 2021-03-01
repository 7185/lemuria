#!/usr/bin/env python
import asyncio
from typing import Callable
from contextlib import suppress

class Timer:
    def __init__(self, timeout: int, callback: Callable) -> None:
        self._timeout = timeout
        self._callback = callback
        self._task = asyncio.ensure_future(self._job())

    async def _job(self) -> None:
        await asyncio.sleep(self._timeout)
        await self._callback()

    async def cancel(self) -> None:
        if not self._task.cancelled():
            self._task.cancel()
            with suppress(asyncio.CancelledError):
                await self._task
