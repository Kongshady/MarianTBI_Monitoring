import { Dialog as DialogPrimitive } from "radix-ui";
import { FiX } from "react-icons/fi";
import { cn } from "../../lib/utils.js";

// Centred modal for forms. Built on the same Radix Dialog primitive that
// Sheet already pulls in, so adopting it costs no extra bundle weight.
//
// The panels previously hand-rolled `fixed inset-0 bg-black/50` overlays
// with no focus trap, no Escape handling and no aria-modal wiring.
function Dialog({ ...props }) {
  return <DialogPrimitive.Root {...props} />;
}

function DialogTrigger({ ...props }) {
  return <DialogPrimitive.Trigger {...props} />;
}

function DialogClose({ ...props }) {
  return <DialogPrimitive.Close {...props} />;
}

function DialogContent({ className, children, showClose = true, ...props }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-[60] bg-primary/55 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          className
        )}
      />
      <DialogPrimitive.Content
        // aria-modal is set explicitly rather than relying solely on Radix's
        // hide-others pass: with several portals mounted (nav sheet, search
        // sheet, bell popover) the app root was not always marked aria-hidden,
        // which would leave background content reachable to screen readers.
        aria-modal="true"
        className={cn(
          "fixed left-1/2 top-1/2 z-[60] max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-card p-5 shadow-dialog duration-200",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute top-3.5 right-3.5 rounded-md p-1.5 text-muted transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <FiX className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }) {
  return <div className={cn("mb-4 pr-8", className)} {...props} />;
}

function DialogTitle({ className, ...props }) {
  return (
    <DialogPrimitive.Title
      className={cn("text-base font-semibold text-ink", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }) {
  return (
    <DialogPrimitive.Description
      className={cn("mt-1 text-sm text-muted", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }) {
  return (
    <div
      className={cn("mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
