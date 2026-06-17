# Multi-Language Translation System

Comprehensive guide for implementing and using the multi-language translation system in the Vertex platform.

## Supported Languages

- **English** (en)
- **French** (fr)
- **Russian** (ru)
- **Japanese** (ja)
- **Spanish** (es)

## Architecture Overview

### Backend (Python/FastAPI)

**Components:**
- `TranslationService` - Core service for managing translations
- `Language` enum - Supported language codes
- Translation API endpoints
- Language middleware for automatic detection
- TypeScript type generator

**Files:**
- `app/services/translation_service.py` - Main service class
- `app/translations/*.json` - Translation files for each language
- `api/routes/translations.py` - API endpoints
- `api/middleware/language_middleware.py` - Language detection middleware
- `app/services/translation_types_generator.py` - Type generator for frontend

### Frontend (React/TypeScript)

**Components:**
- `TranslationContext` - React Context for managing language state
- `LanguageSwitcher` - UI component for language selection
- `TranslatedText` - Generic translated text component
- `TranslatedButton` - Translated button component
- `TranslatedInput` - Translated input component with labels
- `TranslatedAlert` - Translated alert dialog component

**Files:**
- `frontend/context/TranslationContext.tsx` - Translation provider and hook
- `frontend/components/LanguageSwitcher.tsx` - Language selector UI
- `frontend/components/TranslatedText.tsx` - Text component
- `frontend/components/TranslatedButton.tsx` - Button component
- `frontend/components/TranslatedInput.tsx` - Input component
- `frontend/components/TranslatedAlert.tsx` - Alert component

## Backend Setup

### 1. Initialize Translation Service

```python
from app.services.translation_service import get_translation_service

# Get the global translation service instance
service = get_translation_service()

# Get a translation
text = service.get_translation('auth.login.title', language='en')

# Get all translations for a language
all_translations = service.get_all_translations('fr')

# Get supported languages
languages = service.get_supported_languages()
```

### 2. Add API Routes

In `api/main.py`, add the translation routes:

```python
from api.routes import translations

# Include translation routes
app.include_router(translations.router)
```

### 3. Add Language Middleware

In `api/main.py`, add the middleware:

```python
from api.middleware.language_middleware import LanguageMiddleware

# Add language detection middleware
app.middleware("http")(LanguageMiddleware(app))
```

### 4. Use Translations in Routes

```python
from fastapi import Request
from app.services.translation_service import get_translation_service

@app.get("/api/example")
async def example_endpoint(request: Request):
    service = get_translation_service()
    language = request.state.language  # Set by middleware
    
    welcome_msg = service.get_translation(
        'auth.login.title', 
        language=language
    )
    
    return {"message": welcome_msg}
```

## Frontend Setup

### 1. Wrap Application with TranslationProvider

In `frontend/app/layout.tsx` or your root component:

```tsx
import { TranslationProvider } from '@/context/TranslationContext';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <TranslationProvider>
          {children}
        </TranslationProvider>
      </body>
    </html>
  );
}
```

### 2. Add Language Switcher to Navigation

```tsx
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function Navigation() {
  return (
    <nav>
      <div>Your App</div>
      <LanguageSwitcher />
    </nav>
  );
}
```

### 3. Use Translations in Components

**Using the hook:**

```tsx
import { useTranslation } from '@/context/TranslationContext';

export function LoginPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('auth.login.title')}</h1>
      <label>{t('auth.login.email_label')}</label>
      <p>{t('common.loading')}</p>
    </div>
  );
}
```

**Using TranslatedText component:**

```tsx
import { TranslatedText } from '@/components/TranslatedText';

export function WelcomeSection() {
  return (
    <div>
      <TranslatedText 
        keyPath="jobseeker.dashboard.welcome"
        variables={{ name: 'John' }}
        as="h1"
        className="text-2xl font-bold"
      />
    </div>
  );
}
```

**Using TranslatedButton component:**

```tsx
import { TranslatedButton } from '@/components/TranslatedButton';

export function LoginForm() {
  return (
    <form>
      <TranslatedButton 
        labelKey="auth.login.submit_button"
        type="submit"
        variant="default"
      />
    </form>
  );
}
```

**Using TranslatedInput component:**

```tsx
import { TranslatedInput } from '@/components/TranslatedInput';

export function EmailInput() {
  return (
    <TranslatedInput
      type="email"
      labelKey="auth.login.email_label"
      placeholder="common.search"
      errorKey="auth.login.error_invalid_credentials"
    />
  );
}
```

## Translation Keys Reference

Translation keys use dot notation for nested access. Common sections:

### Auth
- `auth.login.*` - Login page strings
- `auth.register.*` - Registration page strings
- `auth.forgot_password.*` - Password reset strings

### Navigation
- `navigation.home`
- `navigation.dashboard`
- `navigation.jobs`
- `navigation.profile`
- `navigation.settings`
- `navigation.logout`
- `navigation.language`

### Job Seeker
- `jobseeker.dashboard.*` - Dashboard strings
- `jobseeker.cv_upload.*` - CV upload strings
- `jobseeker.job_matching.*` - Job matching strings
- `jobseeker.skills_gap.*` - Skills gap analyzer strings
- `jobseeker.profile.*` - Profile strings

### Company
- `company.dashboard.*` - Dashboard strings
- `company.job_posting.*` - Job posting strings
- `company.applicant_pipeline.*` - Pipeline strings
- `company.candidate_search.*` - Search strings
- `company.profile.*` - Profile strings

### Common
- `common.loading` - "Loading..."
- `common.error` - "An error occurred"
- `common.success` - "Success"
- `common.yes` / `common.no`
- `common.save` / `common.cancel`
- `common.delete` / `common.edit`

## Adding New Translations

### 1. Add to English Translation File

Edit `app/translations/en.json`:

```json
{
  "feature": {
    "section": {
      "key": "English text here"
    }
  }
}
```

### 2. Add to Other Language Files

Edit corresponding files (`fr.json`, `ru.json`, `ja.json`, `es.json`):

```json
{
  "feature": {
    "section": {
      "key": "Translated text here"
    }
  }
}
```

### 3. Use in Code

**Backend:**
```python
service = get_translation_service()
text = service.get_translation('feature.section.key', language='en')
```

**Frontend:**
```tsx
const { t } = useTranslation();
const text = t('feature.section.key');
```

## Variables in Translations

Use curly braces `{variable_name}` in translation strings:

**In JSON:**
```json
{
  "greeting": "Hello, {name}!"
}
```

**Backend Usage:**
```python
text = service.get_translation(
    'greeting',
    language='en',
    name='John'
)
# Output: "Hello, John!"
```

**Frontend Usage:**
```tsx
const { t } = useTranslation();
const greeting = t('greeting', { name: 'John' });
// Output: "Hello, John!"
```

## Language Detection

The system automatically detects language in this order:

1. **Query Parameter:** `?lang=fr`
2. **Browser Language:** From `Accept-Language` header
3. **Cookie:** Previously stored language preference
4. **Default:** English (`en`)

### Frontend Language Persistence

- Language preference is saved to localStorage
- A 1-year cookie is set for server-side detection
- Browser language is used as fallback on first visit

## API Endpoints

### Get Supported Languages

```
GET /api/translations/languages
```

Response:
```json
{
  "languages": [
    { "code": "en", "name": "English" },
    { "code": "fr", "name": "Français" },
    ...
  ]
}
```

### Get All Translations

```
GET /api/translations/all?language=en
```

Response:
```json
{
  "language": "en",
  "translations": { ... }
}
```

### Get Single Translation

```
GET /api/translations/key?key=auth.login.title&language=en
```

Response:
```json
{
  "key": "auth.login.title",
  "language": "en",
  "translation": "Login to Vertex"
}
```

### Get Multiple Translations

```
POST /api/translations/translate?language=en
Body: ["auth.login.title", "common.save"]
```

Response:
```json
{
  "language": "en",
  "translations": {
    "auth.login.title": "Login to Vertex",
    "common.save": "Save"
  }
}
```

## Best Practices

1. **Always use translation keys** - Never hardcode UI strings
2. **Organize keys hierarchically** - Use meaningful dot-separated paths
3. **Keep translations complete** - Add strings to all language files
4. **Use components** - Leverage `TranslatedButton`, `TranslatedInput`, etc.
5. **Test all languages** - Verify translations display correctly
6. **Handle missing keys gracefully** - System returns the key if translation not found
7. **Use variables for dynamic content** - Don't concatenate strings
8. **Document new translations** - Add comments for context

## Troubleshooting

### Translations Not Loading

- Check that `NEXT_PUBLIC_API_URL` is set correctly in frontend
- Verify translation files exist in `app/translations/`
- Check browser console for API errors
- Ensure `TranslationProvider` wraps your app

### Language Not Persisting

- Check if cookies are enabled
- Verify localStorage is not blocked
- Check browser DevTools Application tab

### Missing Translation Key

- Verify key exists in `app/translations/en.json`
- Check for typos in the key path
- System will return the key itself if not found

## Performance Considerations

- Translations are loaded once on app startup
- All translations for a language are fetched together
- Use `useTranslation()` hook for optimal re-render performance
- Translation strings are cached in context

## Future Enhancements

- [ ] Lazy loading of translation files
- [ ] Translation management UI in admin panel
- [ ] Real-time translation updates without reload
- [ ] Pluralization support
- [ ] Date/time locale formatting
- [ ] Currency formatting per language
- [ ] RTL language support (Arabic, Hebrew)
