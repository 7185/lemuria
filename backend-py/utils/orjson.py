#!/usr/bin/env python
"""orjson module"""

import orjson
from quart.json.provider import JSONProvider


class OrJSONProvider(JSONProvider):
    """OrJSONProvider class for a faster JSONProvider"""
    option = orjson.OPT_NON_STR_KEYS # pylint: disable=maybe-no-member

    def dumps(self, obj, **kwargs):
        """Dumps JSON"""
        return orjson.dumps(obj, option=self.option).decode() # pylint: disable=maybe-no-member

    def loads(self, s, **kwargs):
        """Loads JSON"""
        return orjson.loads(s) # pylint: disable=maybe-no-member
