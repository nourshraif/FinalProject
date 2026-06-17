"""API routes for translation endpoints."""

from fastapi import APIRouter, Query
from app.services.translation_service import get_translation_service, Language

router = APIRouter(prefix="/api/translations", tags=["translations"])


@router.get("/languages")
async def get_supported_languages():
    """Get list of supported languages.

    Returns:
        List of supported languages with codes and display names
    """
    service = get_translation_service()
    return {"languages": service.get_supported_languages()}


@router.get("/all")
async def get_all_translations(language: str = Query("en", description="Language code")):
    """Get all translations for a specific language.

    Args:
        language: Language code (en, fr, ru, ja, es)

    Returns:
        Dictionary containing all translations for the language
    """
    service = get_translation_service()
    translations = service.get_all_translations(language)
    return {"language": language, "translations": translations}


@router.get("/key")
async def get_translation(
    key: str = Query(..., description="Translation key (dot-separated)"),
    language: str = Query("en", description="Language code"),
):
    """Get a specific translation by key.

    Args:
        key: Translation key using dot notation (e.g., 'auth.login.title')
        language: Language code (en, fr, ru, ja, es)

    Returns:
        The translated string for the given key
    """
    service = get_translation_service()
    translation = service.get_translation(key, language)
    return {
        "key": key,
        "language": language,
        "translation": translation,
    }


@router.post("/translate")
async def translate_multiple(
    keys: list[str], language: str = Query("en", description="Language code")
):
    """Get translations for multiple keys at once.

    Args:
        keys: List of translation keys
        language: Language code (en, fr, ru, ja, es)

    Returns:
        Dictionary mapping keys to their translations
    """
    service = get_translation_service()
    result = {}
    for key in keys:
        result[key] = service.get_translation(key, language)
    return {"language": language, "translations": result}
