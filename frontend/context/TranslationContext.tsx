'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type LanguageCode = 'en' | 'fr' | 'ru' | 'ja' | 'es';

export interface Language {
  code: LanguageCode;
  name: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'ru', name: 'Русский' },
  { code: 'ja', name: '日本語' },
  { code: 'es', name: 'Español' },
];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

interface Translation {
  [key: string]: Translation | string;
}

interface TranslationContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  translations: Translation;
  t: (key: string, vars?: Record<string, string | number>) => string;
  isLoading: boolean;
}

const TranslationContext = createContext<TranslationContextType | undefined>(
  undefined
);

export function TranslationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [translations, setTranslations] = useState<Translation>({});
  const [isLoading, setIsLoading] = useState(true);

  // Initialize language from localStorage and browser preferences
  useEffect(() => {
    const initializeLanguage = async () => {
      // Try to get from localStorage
      let savedLanguage = localStorage.getItem('language') as LanguageCode | null;

      // If not found, try to get from browser language
      if (!savedLanguage) {
        const browserLang = navigator.language.split('-')[0] as LanguageCode;
        savedLanguage = SUPPORTED_LANGUAGES.some((l) => l.code === browserLang)
          ? browserLang
          : DEFAULT_LANGUAGE;
      }

      setLanguageState(savedLanguage);
      await fetchTranslations(savedLanguage);
    };

    initializeLanguage();
  }, []);

  const fetchTranslations = async (lang: LanguageCode) => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/translations/all?language=${lang}`
      );
      if (response.ok) {
        const data = await response.json();
        setTranslations(data.translations || {});
      }
    } catch (error) {
      console.error('Failed to fetch translations:', error);
      // Fallback to empty translations
      setTranslations({});
    } finally {
      setIsLoading(false);
    }
  };

  const setLanguage = async (lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    // Also set cookie for server-side detection
    document.cookie = `language=${lang}; max-age=${60 * 60 * 24 * 365}; path=/`;
    await fetchTranslations(lang);
  };

  const t = (
    key: string,
    vars?: Record<string, string | number>
  ): string => {
    // Navigate through nested object using dot notation
    let value: any = translations;
    for (const part of key.split('.')) {
      value = value?.[part];
      if (value === undefined) return key; // Return key if not found
    }

    if (typeof value !== 'string') return key;

    // Replace variables if provided
    if (vars) {
      return value.replace(/{([^}]+)}/g, (match, varName) => {
        return String(vars[varName] ?? match);
      });
    }

    return value;
  };

  return (
    <TranslationContext.Provider
      value={{
        language,
        setLanguage,
        translations,
        t,
        isLoading,
      }}
    >
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within TranslationProvider');
  }
  return context;
}
