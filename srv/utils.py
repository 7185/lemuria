#!/usr/bin/env python
import trio
from typing import Callable
from contextlib import suppress

class Timer:
    def __init__(self, timeout: int, callback: Callable, nursery: trio.Nursery) -> None:
        self._timeout = timeout
        self._callback = callback
        self._nursery = nursery
        self._cancel_scope = trio.CancelScope()

    async def start(self) -> None:
        with self._cancel_scope:
            await trio.sleep(self._timeout)
            self._nursery.start_soon(self._callback)

    async def cancel(self) -> None:
        self._cancel_scope.cancel()