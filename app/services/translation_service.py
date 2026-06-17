"""Translation service for multi-language support.

Supports: English, French, Russian, Japanese, Spanish
"""

import json
from pathlib import Path
from typing import Dict, Optional, List
from enum import Enum


class Language(str, Enum):
    """Supported languages."""
    ENGLISH = "en"
    FRENCH = "fr"
    RUSSIAN = "ru"
    JAPANESE = "ja"
    SPANISH = "es"


class TranslationService:
    """Service for managing translations across the platform."""

    SUPPORTED_LANGUAGES = [
        Language.ENGLISH,
        Language.FRENCH,
        Language.RUSSIAN,
        Language.JAPANESE,
        Language.SPANISH,
    ]

    LANGUAGE_NAMES = {
        Language.ENGLISH: "English",
        Language.FRENCH: "Français",
        Language.RUSSIAN: "Русский",
        Language.JAPANESE: "日本語",
        Language.SPANISH: "Español",
    }

    def __init__(self):
        """Initialize translation service and load translation files."""
        self.translations: Dict[str, Dict[str, str]] = {}
        self._load_translations()

    def _load_translations(self) -> None:
        """Load all translation files from the translations directory."""
        translations_dir = Path(__file__).parent.parent / "translations"
        translations_dir.mkdir(exist_ok=True)

        for lang in self.SUPPORTED_LANGUAGES:
            file_path = translations_dir / f"{lang.value}.json"
            if file_path.exists():
                with open(file_path, "r", encoding="utf-8") as f:
                    self.translations[lang.value] = json.load(f)
            else:
                self.translations[lang.value] = {}

    def get_translation(
        self, key: str, language: str = Language.ENGLISH.value, **kwargs
    ) -> str:
        """Get a translated string.

        Args:
            key: Translation key (dot-separated path, e.g., 'auth.login.title')
            language: Language code (default: English)
            **kwargs: Variables to substitute in the translation

        Returns:
            Translated string, or the key if translation not found
        """
        if language not in self.SUPPORTED_LANGUAGES:
            language = Language.ENGLISH.value

        # Navigate nested dictionary using dot notation
        value = self.translations.get(language, {})
        for part in key.split("."):
            if isinstance(value, dict):
                value = value.get(part)
            else:
                return key  # Key not found

        if value is None:
            return key

        # Substitute variables if provided
        if kwargs:
            try:
                return value.format(**kwargs)
            except (KeyError, ValueError):
                return value

        return value

    def get_all_translations(self, language: str = Language.ENGLISH.value) -> Dict:
        """Get all translations for a language.

        Args:
            language: Language code

        Returns:
            Dictionary of all translations
        """
        if language not in self.SUPPORTED_LANGUAGES:
            language = Language.ENGLISH.value
        return self.translations.get(language, {})

    def get_supported_languages(self) -> List[Dict[str, str]]:
        """Get list of supported languages with their names.

        Returns:
            List of language dictionaries with code and name
        """
        return [
            {"code": lang.value, "name": self.LANGUAGE_NAMES[lang]}
            for lang in self.SUPPORTED_LANGUAGES
        ]

    def translate_dict(
        self, data: Dict, language: str = Language.ENGLISH.value
    ) -> Dict:
        """Translate all values in a dictionary that match translation keys.

        Args:
            data: Dictionary with potential translation keys
            language: Language code

        Returns:
            Dictionary with translated values
        """
        translated = {}
        for key, value in data.items():
            if isinstance(value, str) and "." in value:
                translated[key] = self.get_translation(value, language)
            else:
                translated[key] = value
        return translated


# Global instance
_translation_service: Optional[TranslationService] = None


def get_translation_service() -> TranslationService:
    """Get or create the global translation service."""
    global _translation_service
    if _translation_service is None:
        _translation_service = TranslationService()
    return _translation_service
