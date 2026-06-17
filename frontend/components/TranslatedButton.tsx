'use client';

import { useTranslation } from '@/context/TranslationContext';
import { Button } from '@/components/ui/button';

interface TranslatedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  labelKey: string;
  variables?: Record<string, string | number>;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost';
}

export function TranslatedButton({
  labelKey,
  variables,
  ...props
}: TranslatedButtonProps) {
  const { t } = useTranslation();

  return (
    <Button {...props}>
      {t(labelKey, variables)}
    </Button>
  );
}
