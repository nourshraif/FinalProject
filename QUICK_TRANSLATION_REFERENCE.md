# Translation System - Quick Reference

## Supported Languages
- 🇬🇧 English (en)
- 🇫🇷 French (fr)
- 🇷🇺 Russian (ru)
- 🇯🇵 Japanese (ja)
- 🇪🇸 Spanish (es)

## Backend Quick Start

```python
from app.services.translation_service import get_translation_service

service = get_translation_service()
text = service.get_translation('auth.login.title', language='en')
```

## Frontend Quick Start

```tsx
import { useTranslation } from '@/context/TranslationContext';

function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('auth.login.title')}</h1>;
}
```

## Files Overview

### Backend
| File | Purpose |
|------|----------|
| `app/services/translation_service.py` | Core translation service |
| `app/translations/*.json` | Translation files (en, fr, ru, ja, es) |
| `api/routes/translations.py` | API endpoints |
| `api/middleware/language_middleware.py` | Language detection middleware |
| `app/services/translation_types_generator.py` | TypeScript type generator |

### Frontend
| File | Purpose |
|------|----------|
| `frontend/context/TranslationContext.tsx` | Translation provider & hook |
| `frontend/components/LanguageSwitcher.tsx` | Language selector UI |
| `frontend/components/TranslatedText.tsx` | Text component |
| `frontend/components/TranslatedButton.tsx` | Button component |
| `frontend/components/TranslatedInput.tsx` | Input component |
| `frontend/components/TranslatedAlert.tsx` | Alert component |

## Common Translation Keys

### Authentication
- `auth.login.title`
- `auth.login.email_label`
- `auth.login.password_label`
- `auth.login.submit_button`
- `auth.register.title`
- `auth.forgot_password.title`

### Navigation
- `navigation.home`
- `navigation.dashboard`
- `navigation.jobs`
- `navigation.profile`
- `navigation.logout`

### Common
- `common.loading` - "Loading..."
- `common.error` - "An error occurred"
- `common.success` - "Success"
- `common.save` - "Save"
- `common.cancel` - "Cancel"
- `common.yes` - "Yes"
- `common.no` - "No"

## API Endpoints

```
GET  /api/translations/languages
GET  /api/translations/all?language=en
GET  /api/translations/key?key=auth.login.title&language=en
POST /api/translations/translate?language=en
```

## Language Detection Order

1. Query parameter: `?lang=fr`
2. Accept-Language header
3. Stored cookie/localStorage
4. Browser language
5. Default: English

## Common Usage Patterns

### Get Text
```tsx
const text = t('auth.login.title');
```

### With Variables
```tsx
const greeting = t('jobseeker.dashboard.welcome', { name: 'Alice' });
```

### In Components
```tsx
<TranslatedButton labelKey="auth.login.submit_button" />
<TranslatedInput labelKey="auth.login.email_label" />
```

### Switch Language
```tsx
const { setLanguage } = useTranslation();
setLanguage('fr');
```

## Integration Checklist

- [ ] TranslationProvider wraps root component
- [ ] Translation files exist for all languages
- [ ] API middleware includes LanguageMiddleware
- [ ] Translation routes included in FastAPI app
- [ ] Environment variable NEXT_PUBLIC_API_URL set
- [ ] Language switcher added to navigation
- [ ] All UI strings use translation keys
- [ ] All languages tested

## Environment Setup

```bash
# Frontend
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000' > frontend/.env.local

# Python
cd app
python -m services.translation_types_generator  # Generate TS types
```

## Adding New Translations

1. Add to `app/translations/en.json`
2. Add to other language files
3. Use in code: `t('your.new.key')`
4. Test in all languages

## Support

For detailed information, see:
- `TRANSLATION_GUIDE.md` - Complete guide
- `BACKEND_TRANSLATION_GUIDE.md` - Backend details
- `FRONTEND_TRANSLATION_GUIDE.md` - Frontend details
