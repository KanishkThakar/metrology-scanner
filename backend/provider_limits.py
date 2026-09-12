"""Small, process-local request budgets for the public demo's paid API key."""
from collections import OrderedDict, deque
from threading import Lock
from time import monotonic
from fastapi import HTTPException, Request

_lock = Lock()
_hour = deque()
_clients = OrderedDict()


def provider_budget(request: Request):
    now = monotonic()
    peer = request.client.host if request.client else 'unknown'
    with _lock:
        while _hour and _hour[0] < now - 3600:
            _hour.popleft()
        recent = _clients.pop(peer, deque())
        while recent and recent[0] < now - 60:
            recent.popleft()
        _clients[peer] = recent
        while len(_clients) > 1024:
            _clients.popitem(last=False)
        if len(_hour) >= 300 or len(recent) >= 30:
            raise HTTPException(429, 'Voice service request limit reached. Please pause and try again later.', headers={'Retry-After':'60'})
        _hour.append(now)
        recent.append(now)
