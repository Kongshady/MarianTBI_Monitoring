import { Dialog as SheetPrimitive } from "radix-ui";
import { FiX } from "react-icons/fi";
import { cn } from "../../lib/utils.js";

// Side drawer built on Radix Dialog. Replaces the hand-rolled mobile
// navigation overlay, which had no focus trap, no Escape handling and no
// body-scroll lock.
function Sheet({ ...props }) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetContent({
  className,
  children,
  side = "left",
  hideClose = false,
  ...props
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-primary/55 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          className
        )}
        {...props}
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col bg-primary text-primary-foreground shadow-dialog transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300",
          side === "left" &&
            "inset-y-0 left-0 h-full w-[300px] border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
          side === "right" &&
            "inset-y-0 right-0 h-full w-[min(92vw,360px)] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          side === "top" &&
            "inset-x-0 top-0 h-auto data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className
        )}
      >
        {children}
        {!hideClose && (
          <SheetPrimitive.Close
            className="absolute right-3 top-3 rounded-md p-1.5 text-primary-foreground/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Close navigation"
          >
            <FiX className="size-4" />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1 border-b border-white/10 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-[15px] font-semibold text-white", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-[13px] text-primary-foreground/70", className)}
      {...props}
    />
  );
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger };
