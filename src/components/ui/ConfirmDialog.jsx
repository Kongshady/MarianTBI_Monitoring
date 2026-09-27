import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog.jsx";

// Accessible confirmation dialog for destructive or final actions.
// Cancel is the default focus — destructive choices need a deliberate tab.
//
// Now backed by Radix AlertDialog, which supplies the focus trap, focus
// restoration on close, Escape handling and aria-modal wiring that the
// previous hand-rolled implementation was missing. The public API is
// unchanged, so every call site keeps working.
function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel?.()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Keep the dialog mounted while the async action runs so the
              // busy state stays visible instead of the panel vanishing.
              e.preventDefault();
              onConfirm?.();
            }}
            variant={danger ? "danger" : "brand"}
            disabled={busy}
          >
            {busy ? "Working..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ConfirmDialog;
