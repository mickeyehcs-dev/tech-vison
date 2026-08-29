"""In-memory chronological history manager for hackathon deployment.

For production/cloud deployment, replace this store with Redis/DB persistence.
"""
from threading import Lock
from typing import Any

class HistoryManager:
    def __init__(self, max_readings: int = 1000):
        self._data = {}
        self._lock = Lock()
        self.max_readings = max_readings

    def append(self, batch_id: str, reading: dict[str, Any]) -> list[dict[str, Any]]:
        with self._lock:
            history = self._data.setdefault(batch_id, [])
            history.append(dict(reading))
            if len(history) > self.max_readings:
                del history[:-self.max_readings]
            return [dict(x) for x in history]

    def get(self, batch_id: str) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(x) for x in self._data.get(batch_id, [])]

    def clear(self, batch_id: str) -> None:
        with self._lock:
            self._data.pop(batch_id, None)

    def size(self, batch_id: str) -> int:
        with self._lock:
            return len(self._data.get(batch_id, []))
