"""Bounded, process-local OCR reuse; no photo bytes or user records are retained."""
from collections import OrderedDict
from copy import deepcopy
import hashlib
from threading import RLock
from time import monotonic

_entries = OrderedDict()
_lock = RLock()
TTL_SECONDS = 600
MAX_ENTRIES = 24


def cached_ocr(image, namespace, compute):
    key = (namespace, image.shape, str(image.dtype), hashlib.sha256(memoryview(image)).digest())
    now = monotonic()
    with _lock:
        existing = _entries.get(key)
        if existing and now - existing[0] < TTL_SECONDS:
            _entries.move_to_end(key)
            return deepcopy(existing[1])
        _entries.pop(key, None)
    result = compute()
    if result[0]:
        with _lock:
            _entries[key] = (monotonic(), deepcopy(result))
            _entries.move_to_end(key)
            while len(_entries) > MAX_ENTRIES:
                _entries.popitem(last=False)
    return result


def clear_ocr_cache():
    with _lock:
        _entries.clear()
