#!/usr/bin/env python
# encoding: utf-8
"""Use instead of `python -m http.server` when you need CORS"""

from http.server import HTTPServer, SimpleHTTPRequestHandler


class CORSRequestHandler(SimpleHTTPRequestHandler):
    """Request Handler"""
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        return super().end_headers()


httpd = HTTPServer(('localhost', 8181), CORSRequestHandler)
httpd.serve_forever()
