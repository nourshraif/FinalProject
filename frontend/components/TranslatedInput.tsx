'use client';

import { useTranslation } from '@/context/TranslationContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface TranslatedInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  labelKey?: string;
  errorKey?: string;
  helperKey?: string;
  containerClassName?: string;
}

export function TranslatedInput({
  labelKey,
  errorKey,
  helperKey,
  containerClassName,
  className,
  ...props
}: TranslatedInputProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('space-y-2', containerClassName)}>
      {labelKey && <Label>{t(labelKey)}</Label>}
      <Input className={className} placeholder={t(props.placeholder as string) || ''} {...props} />
      {errorKey && <p className="text-sm text-red-500">{t(errorKey)}</p>}
      {helperKey && <p className="text-sm text-gray-500">{t(helperKey)}</p>}
    </div>
  );
}
