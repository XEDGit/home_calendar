#!/usr/bin/env python3
"""Starts whisper-server on the first request and stops it when idle.

A resident whisper-server keeps its model in VRAM; when the GPU
runtime-suspends that gets evicted to system RAM and never comes back, so
every later transcription crawls. Stopping the server well before the
autosuspend delay (300 s, llm/80-amdgpu-autosuspend.rules) means each
load lands in VRAM. Arguments are passed to whisper-server as is.
"""
import http.client
import socket
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LISTEN_PORT = 8080
BACKEND_PORT = 8081
IDLE_SECONDS = 60
START_TIMEOUT = 120

lock = threading.Lock()
proc = None
active = 0
last_used = time.monotonic()


def log(msg):
    print(f'[ondemand] {msg}', file=sys.stderr, flush=True)


def ready():
    try:
        socket.create_connection(('127.0.0.1', BACKEND_PORT), timeout=1).close()
        return True
    except OSError:
        return False


def ensure_started():
    """Caller holds lock. whisper-server only listens once the model is loaded."""
    global proc
    if proc and proc.poll() is None:
        return
    log('starting whisper-server')
    proc = subprocess.Popen(['whisper-server', *sys.argv[1:],
                             '--host', '127.0.0.1', '--port', str(BACKEND_PORT)])
    deadline = time.monotonic() + START_TIMEOUT
    while not ready():
        if proc.poll() is not None or time.monotonic() > deadline:
            proc.kill()
            proc = None
            raise RuntimeError('whisper-server failed to start')
        time.sleep(0.2)
    log('whisper-server ready')


def reaper():
    global proc
    while True:
        time.sleep(5)
        with lock:
            if proc and active == 0 and time.monotonic() - last_used > IDLE_SECONDS:
                log('idle, stopping whisper-server')
                proc.terminate()
                try:
                    proc.wait(10)
                except subprocess.TimeoutExpired:
                    proc.kill()
                proc = None


class Proxy(BaseHTTPRequestHandler):
    def forward(self):
        global active, last_used
        body = self.rfile.read(int(self.headers.get('Content-Length') or 0))
        with lock:
            active += 1
            try:
                ensure_started()
            except RuntimeError as e:
                active -= 1
                self.send_error(503, str(e))
                return
        try:
            conn = http.client.HTTPConnection('127.0.0.1', BACKEND_PORT, timeout=300)
            headers = {k: v for k, v in self.headers.items() if k.lower() not in ('host', 'connection')}
            conn.request(self.command, self.path, body=body, headers=headers)
            res = conn.getresponse()
            data = res.read()
            self.send_response(res.status)
            for k, v in res.getheaders():
                if k.lower() not in ('transfer-encoding', 'connection', 'content-length'):
                    self.send_header(k, v)
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except OSError as e:
            self.send_error(502, str(e))
        finally:
            with lock:
                active -= 1
                last_used = time.monotonic()

    do_GET = do_POST = forward

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    threading.Thread(target=reaper, daemon=True).start()
    log(f'listening on {LISTEN_PORT}, whisper-server starts on demand')
    ThreadingHTTPServer(('0.0.0.0', LISTEN_PORT), Proxy).serve_forever()
