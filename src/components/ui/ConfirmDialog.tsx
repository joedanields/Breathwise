import * as AlertDialog from '@radix-ui/react-alert-dialog';
import type { ReactNode } from 'react';

interface ConfirmDialogProps {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}

/**
 * Confirmation for destructive actions (Radix AlertDialog): role="alertdialog",
 * no dismiss by clicking outside, focus starts on Cancel and returns to the trigger.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/50" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-[70] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface p-5 text-text shadow-xl">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-muted">
            {description}
          </AlertDialog.Description>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <AlertDialog.Cancel className="min-h-11 rounded-md border border-accent px-4 font-medium text-accent">
              Cancel
            </AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={onConfirm}
              className="min-h-11 rounded-md bg-aqi-very-poor px-4 font-medium text-on-aqi-very-poor"
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
