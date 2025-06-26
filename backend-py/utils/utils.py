#!/usr/bin/env python
"""Utils module"""

import os

def get_secret_key():
    secret_file = os.environ.get('LEMURIA_SECRET_FILE')
    if secret_file:
        try:
            with open(secret_file, 'r') as f:
                return f.read().strip()
        except Exception as e:
            print(f"Failed to read secret file {secret_file}: {e}")
    return None
