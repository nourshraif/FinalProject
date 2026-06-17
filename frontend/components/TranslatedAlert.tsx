'use client';

import { useTranslation } from '@/context/TranslationContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogTitle>{t(titleKey)}</AlertDialogTitle>
        <AlertDialogDescription>{t(descriptionKey)}</AlertDialogDescription>
        <div className="flex gap-3 justify-end">
          <AlertDialogCancel>{t(cancelKey)}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleAction}
            className={isDestructive ? 'bg-destructive text-destructive-foreground' : ''}
          >
            {t(actionKey)}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
