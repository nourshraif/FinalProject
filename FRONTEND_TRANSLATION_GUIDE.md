# Frontend Integration Guide - Translations

## Setup

### 1. Wrap App with Provider

In `frontend/app/layout.tsx`:

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

### 2. Environment Configuration

Ensure `frontend/.env.local` has:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Or for production:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

## Using Translations

### Hook-based Usage (Recommended)

```tsx
import { useTranslation } from '@/context/TranslationContext';

export function LoginPage() {
  const { t, language, setLanguage } = useTranslation();

  return (
    <div>
      <h1>{t('auth.login.title')}</h1>
      <p>Current language: {language}</p>
      <button onClick={() => setLanguage('fr')}>Français</button>
    </div>
  );
}
```

### Component-based Usage

**Simple Text:**
```tsx
import { TranslatedText } from '@/components/TranslatedText';

<TranslatedText keyPath="common.loading" />

{/* With variables */}
<TranslatedText 
  keyPath="jobseeker.dashboard.welcome"
  variables={{ name: 'Alice' }}
  as="h1"
  className="text-2xl"
/>
```

**Buttons:**
```tsx
import { TranslatedButton } from '@/components/TranslatedButton';

<TranslatedButton 
  labelKey="auth.login.submit_button"
  onClick={handleLogin}
  variant="default"
/>
```

**Input Fields:**
```tsx
import { TranslatedInput } from '@/components/TranslatedInput';

<TranslatedInput
  type="email"
  labelKey="auth.login.email_label"
  placeholder="common.search"
  errorKey="auth.login.error_invalid_credentials"
  containerClassName="mb-4"
/>
```

**Alerts:**
```tsx
import { TranslatedAlert } from '@/components/TranslatedAlert';
import { Button } from '@/components/ui/button';

<TranslatedAlert
  trigger={<Button>Delete</Button>}
  titleKey="common.confirm"
  descriptionKey="company.applicant_pipeline.no_applicants"
  actionKey="common.delete"
  cancelKey="common.cancel"
  onAction={() => handleDelete()}
  isDestructive
/>
```

**Language Switcher:**
```tsx
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

<header>
  <h1>Vertex</h1>
  <LanguageSwitcher />
</header>
```

## Common Patterns

### Form with Translations

```tsx
'use client';

import { useTranslation } from '@/context/TranslationContext';
import { TranslatedInput } from '@/components/TranslatedInput';
import { TranslatedButton } from '@/components/TranslatedButton';
import { useState } from 'react';

export function LoginForm() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Login logic
    } catch (err) {
      setError('auth.login.error_invalid_credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h1>{t('auth.login.title')}</h1>
      
      <TranslatedInput
        type="email"
        labelKey="auth.login.email_label"
        required
      />

      <TranslatedInput
        type="password"
        labelKey="auth.login.password_label"
        required
      />

      {error && (
        <p className="text-red-500">{t(error)}</p>
      )}

      <TranslatedButton
        labelKey="auth.login.submit_button"
        type="submit"
        disabled={isLoading}
      />
    </form>
  );
}
```

### Dashboard with Language Detection

```tsx
'use client';

import { useTranslation } from '@/context/TranslationContext';
import { useEffect, useState } from 'react';

interface DashboardStats {
  applications: number;
  saved_jobs: number;
}

export function JobSeekerDashboard() {
  const { t, language, isLoading } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    // Fetch stats when language changes
    fetchStats();
  }, [language]);

  const fetchStats = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/stats?lang=${language}`
      );
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  if (isLoading) {
    return <div>{t('common.loading')}</div>;
  }

  return (
    <div>
      <h1>{t('jobseeker.dashboard.welcome', { name: 'User' })}</h1>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3>{t('jobseeker.dashboard.total_applications')}</h3>
          <p>{stats?.applications || 0}</p>
        </div>
        <div>
          <h3>{t('jobseeker.dashboard.saved_count')}</h3>
          <p>{stats?.saved_jobs || 0}</p>
        </div>
      </div>
    </div>
  );
}
```

### Error Handling with Translations

```tsx
export function ErrorBoundary({ error }: { error: Error }) {
  const { t } = useTranslation();

  return (
    <div className="bg-red-50 p-4 rounded">
      <h2 className="font-bold">{t('common.error')}</h2>
      <p>{error.message}</p>
      <button onClick={() => window.location.reload()}>
        {t('common.back')}
      </button>
    </div>
  );
}
```

## Advanced Usage

### Custom Hook for Domain-Specific Translations

```tsx
import { useTranslation } from '@/context/TranslationContext';

export function useAuthTranslations() {
  const { t } = useTranslation();

  return {
    login: {
      title: t('auth.login.title'),
      email: t('auth.login.email_label'),
      password: t('auth.login.password_label'),
      submit: t('auth.login.submit_button'),
      error: t('auth.login.error_invalid_credentials'),
    },
    register: {
      title: t('auth.register.title'),
      email: t('auth.register.email_label'),
      password: t('auth.register.password_label'),
    },
  };
}

// Usage
function LoginPage() {
  const auth = useAuthTranslations();
  return <h1>{auth.login.title}</h1>;
}
```

### Conditional Rendering Based on Language

```tsx
export function LocalizedContent() {
  const { language } = useTranslation();

  return (
    <div>
      {language === 'ja' && (
        <div className="text-right">Japanese-specific layout</div>
      )}
      {['ar', 'he'].includes(language) && (
        <div dir="rtl">RTL-specific layout</div>
      )}
    </div>
  );
}
```

## Testing

```tsx
import { render, screen } from '@testing-library/react';
import { TranslationProvider } from '@/context/TranslationContext';
import LoginPage from '@/app/auth/login/page';

test('renders login page in English', () => {
  render(
    <TranslationProvider>
      <LoginPage />
    </TranslationProvider>
  );
  
  expect(screen.getByText('Login to Vertex')).toBeInTheDocument();
});
```

## Performance Optimization

### Memoize Translated Components

```tsx
import { memo } from 'react';

const TranslatedHeader = memo(function TranslatedHeader() {
  const { t } = useTranslation();
  return <header>{t('navigation.home')}</header>;
});
```

### Lazy Load Translations for Large Apps

```tsx
const lazy Translations = lazy(() => 
  import('@/translations/modules').then(m => ({
    default: m.TranslationLoader
  }))
);
```

## Troubleshooting

### Translations Not Loading

```tsx
// Check if provider is wrapping the component
const { isLoading, language, translations } = useTranslation();

if (isLoading) return <div>Loading...</div>;

// Log to debug
console.log('Current language:', language);
console.log('Translations loaded:', Object.keys(translations).length);
```

### Key Not Found

```tsx
const { t } = useTranslation();
const text = t('nonexistent.key');
// Will return: 'nonexistent.key' (the key itself)

// This helps identify missing translations
if (text === 'nonexistent.key') {
  console.warn('Translation missing for: nonexistent.key');
}
```

## Best Practices

1. **Always wrap app with TranslationProvider**
2. **Use `useTranslation()` hook** instead of accessing context directly
3. **Prefer component-based translation** for reusable elements
4. **Lazy load language switcher** on navbar/header
5. **Handle missing translations gracefully** - they return the key
6. **Use TypeScript** for type-safe translation keys
7. **Test in all supported languages** before deployment
8. **Cache translations** in localStorage for faster loads
