"""Bloqueo temporal de login por intentos fallidos (protección básica contra fuerza bruta).

El contador vive en memoria del proceso: alcanza para una instancia en una VM. Con varias
réplicas detrás de un balanceador habría que moverlo a Redis o a la base de datos.
"""

import time
from collections import defaultdict
from threading import Lock

from app.core.config import settings


class LoginThrottle:
    """Cuenta fallos por clave (usuario + IP) dentro de una ventana deslizante."""

    def __init__(self) -> None:
        self._failures: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    @property
    def _window_seconds(self) -> int:
        return settings.LOGIN_LOCKOUT_MINUTES * 60

    def _recent(self, key: str, now: float) -> list[float]:
        recent = [t for t in self._failures.get(key, []) if now - t < self._window_seconds]
        if recent:
            self._failures[key] = recent
        else:
            self._failures.pop(key, None)
        return recent

    def retry_after(self, key: str) -> int:
        """Segundos que faltan para poder reintentar (0 si la clave no está bloqueada)."""
        now = time.monotonic()
        with self._lock:
            recent = self._recent(key, now)
            if len(recent) < settings.LOGIN_MAX_ATTEMPTS:
                return 0
            return max(1, int(self._window_seconds - (now - recent[0])))

    def register_failure(self, key: str) -> None:
        with self._lock:
            self._failures[key].append(time.monotonic())

    def reset(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)


login_throttle = LoginThrottle()
