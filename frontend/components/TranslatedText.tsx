'use client';

import { useTranslation } from '@/context/TranslationContext';

interface TranslatedTextProps {
  keyPath: string;
  variables?: Record<string, string | number>;
  className?: string;
  as?: React.ElementType;
}

export function TranslatedText({
  keyPath,
  variables,
  className,
  as: Component = 'span',
}: TranslatedTextProps) {
  const { t } = useTranslation();
  const text = t(keyPath, variables);

  return <Component className={className}>{text}</Component>;
}
