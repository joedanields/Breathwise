import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

interface SheetProps {
  /** The element that opens the sheet; focus returns to it on close. */
  trigger: ReactNode;
  title: string;
  description?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/**
 * Side sheet (bottom sheet on small screens) built on Radix Dialog: modal,
 * focus-trapped, Esc to close, focus returns to the trigger (UI_UX.md §3.3, §6).
 */
export function Sheet({ trigger, title, description, open, onOpenChange, children }: SheetProps) {
  return (
    <Dialog.Root {...(open === undefined ? {} : { open })} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-2xl bg-surface p-5 text-text shadow-xl sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[32rem] sm:rounded-none"
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="min-h-11 rounded-md px-3 font-medium text-accent underline">
              Close
            </Dialog.Close>
          </div>
          {description && (
            <Dialog.Description className="mb-4 text-muted">{description}</Dialog.Description>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const SheetClose = Dialog.Close;
