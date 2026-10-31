"""Reusable Harbor LAN routing via local HTTPS CONNECT proxy.

Preserves the public hostname for TLS while connecting to a verified LAN VIP.
Routes come from a data file; registry auth stays in a private secret file and
is never written to stdout.
"""
from __future__ import annotations

import json
import select
import socket
import socketserver
import stat
import threading
from pathlib import Path


DEFAULT_ROUTES = {"harbor.ajrly.com": "192.168.68.40"}


def load_route_map(path: Path) -> dict[str, str]:
    raw = json.loads(path.read_text())
    if not isinstance(raw, dict) or not raw:
        raise ValueError("route data file must be a non-empty hostname→IP object")
    routes = {}
    for host, ip in raw.items():
        if not isinstance(host, str) or not isinstance(ip, str) or not host or not ip:
            raise ValueError("route entries must be hostname/IP strings")
        if "/" in ip or ":" in ip:
            raise ValueError("route IP must be a bare IPv4 address")
        routes[host.lower()] = ip
    return routes


def validate_auth_file(path: Path) -> Path:
    mode = path.stat().st_mode
    if not stat.S_ISREG(mode) or mode & 0o077:
        raise ValueError("auth file must be a private regular file (mode 0600)")
    # Parse only to ensure JSON shape; never return secret material to callers.
    doc = json.loads(path.read_text())
    if not isinstance(doc, dict) or "auths" not in doc:
        raise ValueError("auth file must contain an auths object")
    return path


class _Tunnel(socketserver.StreamRequestHandler):
    routes: dict[str, str] = {}

    def handle(self):
        request = self.rfile.readline().decode(errors="replace").split()
        if len(request) < 2 or request[0] != "CONNECT":
            return
        host, port = request[1].rsplit(":", 1)
        while self.rfile.readline().strip():
            pass
        upstream_host = self.routes.get(host.lower(), host)
        with socket.create_connection((upstream_host, int(port)), timeout=30) as upstream:
            self.wfile.write(b"HTTP/1.1 200 Connection established\r\n\r\n")
            self.wfile.flush()
            self.connection.settimeout(None)
            upstream.settimeout(None)
            while True:
                ready, _, _ = select.select([self.connection, upstream], [], [], 60)
                if not ready:
                    return
                for src in ready:
                    data = src.recv(65536)
                    if not data:
                        return
                    (upstream if src is self.connection else self.connection).sendall(data)


class LanConnectProxy:
    """Local CONNECT proxy + auth-file handle for production-like Harbor pulls."""

    def __init__(self, routes_file: Path, auth_file: Path, *, bind_host: str = "127.0.0.1"):
        self.routes = load_route_map(routes_file)
        self.auth_file = validate_auth_file(auth_file)
        handler = type("Tunnel", (_Tunnel,), {"routes": self.routes})
        self._server = socketserver.ThreadingTCPServer((bind_host, 0), handler)
        self._server.daemon_threads = True
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()

    @property
    def listen_url(self) -> str:
        host, port = self._server.server_address[:2]
        return f"http://{host}:{port}"

    def proxy_env(self) -> dict[str, str]:
        url = self.listen_url
        return {"HTTPS_PROXY": url, "HTTP_PROXY": url, "NO_PROXY": ""}

    def summary(self) -> dict:
        return {
            "listen": self.listen_url,
            "routes": dict(self.routes),
            "auth_file_present": self.auth_file.is_file(),
            "dns_modified": False,
            "tls_hostname_preserved": True,
        }

    def close(self) -> None:
        self._server.shutdown()
        self._server.server_close()
