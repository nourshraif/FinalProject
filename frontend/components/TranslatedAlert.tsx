'use client';

import { useTranslation } from '@/context/TranslationContext';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface TranslatedAlertProps {
  trigger?: React.ReactNode;
  titleKey: string;
  descriptionKey: string;
  actionKey?: string;
  cancelKey?: string;
  onAction?: () => void;
  isDestructive?: boolean;
}

export function TranslatedAlert({
  trigger,
  titleKey,
  descriptionKey,
  actionKey = 'common.confirm',
  cancelKey = 'common.cancel',
  onAction,
  isDestructive = false,
}: TranslatedAlertProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleAction = () => {
    onAction?.();
    setOpen(false);
  };

  return (
    <>
      {trigger && (
        <span onClick={() => setOpen(true)} className="inline-flex">
          {trigger}
        </span>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-vertex-border bg-vertex-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-vertex-white">{t(titleKey)}</h2>
            <p className="mt-2 text-sm text-vertex-muted">{t(descriptionKey)}</p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t(cancelKey)}
              </Button>
              <Button
                variant={isDestructive ? 'destructive' : 'default'}
                onClick={handleAction}
              >
                {t(actionKey)}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
