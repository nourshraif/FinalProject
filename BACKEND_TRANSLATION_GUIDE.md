# Backend Integration Guide - Translations

## Quick Start

### 1. Import and Get Service Instance

```python
from app.services.translation_service import (
    get_translation_service,
    Language
)

service = get_translation_service()
```

### 2. Get a Translation

```python
# Simple translation
title = service.get_translation('auth.login.title', language='en')

# With variables
greeting = service.get_translation(
    'jobseeker.dashboard.welcome',
    language='fr',
    name='Jean'
)
```

### 3. In FastAPI Routes

```python
from fastapi import APIRouter, Request
from app.services.translation_service import get_translation_service

router = APIRouter()

@router.get("/dashboard")
async def get_dashboard(request: Request):
    service = get_translation_service()
    
    # Get language from middleware
    language = getattr(request.state, 'language', 'en')
    
    # Get translations
    welcome = service.get_translation(
        'jobseeker.dashboard.welcome',
        language=language,
        name="User Name"
    )
    
    return {
        "welcome_message": welcome,
        "current_language": language
    }
```

## Common Patterns

### Error Messages

```python
errors = {
    'email_exists': service.get_translation(
        'auth.register.error_email_exists',
        language=lang
    ),
    'invalid_credentials': service.get_translation(
        'auth.login.error_invalid_credentials',
        language=lang
    )
}

return {"errors": errors}
```

### Form Labels

```python
form_labels = {
    'email': service.get_translation('auth.login.email_label', language=lang),
    'password': service.get_translation('auth.login.password_label', language=lang),
}
```

### Email Notifications

```python
email_subject = service.get_translation(
    'emails.welcome.subject',
    language=user_language
)

email_body = service.get_translation(
    'emails.welcome.body',
    language=user_language,
    username=user.name
)
```

## Adding Translation Support to Existing Routes

### Before
```python
@router.post("/auth/login")
async def login(credentials: LoginRequest):
    user = db.get_user(credentials.email)
    if not user:
        return {"error": "Invalid email or password"}
```

### After
```python
@router.post("/auth/login")
async def login(request: Request, credentials: LoginRequest):
    service = get_translation_service()
    language = getattr(request.state, 'language', 'en')
    
    user = db.get_user(credentials.email)
    if not user:
        error_msg = service.get_translation(
            'auth.login.error_invalid_credentials',
            language=language
        )
        return {"error": error_msg}
```

## Database Storage

If storing user-related translations in the database:

```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True)
    preferred_language = Column(String, default="en")
    
    @property
    def language(self):
        return self.preferred_language or "en"

# Usage
user_language = user.language
translation = service.get_translation(
    'auth.login.title',
    language=user_language
)
```

## Testing Translations

```python
import pytest
from app.services.translation_service import get_translation_service

def test_english_translation():
    service = get_translation_service()
    text = service.get_translation('auth.login.title', 'en')
    assert text == "Login to Vertex"
    assert text != ""  # Not empty

def test_french_translation():
    service = get_translation_service()
    text = service.get_translation('auth.login.title', 'fr')
    assert text != ""  # Has content
    assert text != "auth.login.title"  # Not the key itself

def test_translation_with_variables():
    service = get_translation_service()
    text = service.get_translation(
        'jobseeker.dashboard.welcome',
        language='en',
        name='John'
    )
    assert 'John' in text
```

## Managing Translations

### List All Available Keys

```python
from app.services.translation_service import get_translation_service
import json

service = get_translation_service()
translations = service.get_all_translations('en')

def extract_keys(obj, prefix=""):
    keys = []
    for key, value in obj.items():
        full_key = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            keys.extend(extract_keys(value, full_key))
        else:
            keys.append(full_key)
    return keys

all_keys = extract_keys(translations)
for key in sorted(all_keys):
    print(key)
```

### Validate Translation Completeness

```python
def validate_translations():
    service = get_translation_service()
    en_keys = set(extract_keys(service.get_all_translations('en')))
    
    for lang in ['fr', 'ru', 'ja', 'es']:
        lang_keys = set(extract_keys(service.get_all_translations(lang)))
        missing = en_keys - lang_keys
        if missing:
            print(f"Missing in {lang}: {missing}")
        extra = lang_keys - en_keys
        if extra:
            print(f"Extra in {lang}: {extra}")
```

## Performance Tips

1. **Cache translations at request level** if used multiple times
2. **Load all at startup** - Translations are loaded once on service initialization
3. **Use the service pattern** - Get the singleton instance, don't create new ones
4. **Batch requests** - Use the `/api/translations/translate` endpoint for multiple keys

## Middleware Setup

Ensure middleware is set up in `api/main.py`:

```python
from api.middleware.language_middleware import LanguageMiddleware

# Add before route registration
app.middleware("http")(LanguageMiddleware(app))

# Now all requests have language in request.state.language
```
