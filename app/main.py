"""
Application entrypoint (backend skeleton).

This file is intentionally minimal and framework-agnostic. It wires up
the high-level layers (api, services, database, utils) so that you can
easily plug in a web framework like FastAPI or Flask, or run CLI tasks.
"""

from app import api, services, database, utils  # type: ignore[unused-import]


def bootstrap() -> None:
    """
    Place for any future startup/initialization logic.

    Keeping this function empty preserves current behavior while
    preparing the project for a more complete backend (and Docker
    entrypoint) in the future.
    """

    return None


if __name__ == "__main__":
    # For now we just run bootstrap; extend this to start an ASGI/WSGI
    # server once you choose a web framework.
    bootstrap()

