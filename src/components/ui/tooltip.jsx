import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "../../lib/utils.js";

function TooltipProvider({ delayDuration = 250, ...props }) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
  );
}

function Tooltip({ ...props }) {
  return <TooltipPrimitive.Root {...props} />;
}

function TooltipTrigger({ ...props }) {
  return <TooltipPrimitive.Trigger {...props} />;
}

function TooltipContent({ className, sideOffset = 6, children, ...props }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-[80] max-w-[240px] rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground shadow-popover",
          "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0",
          className
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
