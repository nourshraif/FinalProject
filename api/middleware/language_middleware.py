"""Middleware for setting user language preference."""

from fastapi import Request
from typing import Optional


class LanguageMiddleware:
    """Middleware to detect and set user language from headers or cookies."""

    SUPPORTED_LANGUAGES = ["en", "fr", "ru", "ja", "es"]
    DEFAULT_LANGUAGE = "en"

    def __init__(self, app):
        """Initialize middleware.

        Args:
            app: FastAPI application instance
        """
        self.app = app

    async def __call__(self, request: Request, call_next):
        """Process request to set language.

        Args:
            request: HTTP request object
            call_next: Next middleware/route handler

        Returns:
            Response with language set in request state
        """
        # Try to get language from query parameter first
        language = request.query_params.get("lang")

        # Then try Accept-Language header
        if not language:
            accept_language = request.headers.get("Accept-Language", "")
            if accept_language:
                # Parse the first language preference
                language = accept_language.split(",")[0].split("-")[0].lower()

        # Try to get from cookie
        if not language:
            language = request.cookies.get("language")

        # Validate language
        if not language or language not in self.SUPPORTED_LANGUAGES:
            language = self.DEFAULT_LANGUAGE

        # Store in request state
        request.state.language = language

        # Call next middleware/route
        response = await call_next(request)

        # Set language cookie
        response.set_cookie(
            "language",
            language,
            max_age=60 * 60 * 24 * 365,  # 1 year
            httponly=True,
            samesite="lax",
        )

        return response
