import { Progress as ProgressPrimitive } from "radix-ui";
import { cn } from "../../lib/utils.js";

// Determinate progress bar. The fill uses the role accent so progress
// reads as part of the user's identity context rather than a generic
// blue. The numeric value is exposed to assistive tech via aria-valuenow
// on the Radix root, and the visible label is always provided by the
// caller so colour is never the only signal.
function Progress({ value, className, indicatorClassName, label, ...props }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={pct}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-line", className)}
      aria-label={label}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn("h-full w-full flex-1 bg-accent transition-transform duration-500", indicatorClassName)}
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
