import { Slot } from "radix-ui";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils.js";

// PMIS button. The default variant is the *role accent*, not navy: the
// single most important way a user identifies which side of the system
// they are on is the colour of the primary action. Navy is kept for
// neutral/structural actions where identity is irrelevant.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Role-accent primary action.
        brand: "bg-accent text-white hover:brightness-110 active:brightness-95",
        // Neutral structural action (navy).
        primary: "bg-primary text-primary-foreground hover:bg-primary-deep",
        outline:
          "border border-line bg-white text-ink hover:bg-surface-hover hover:border-line-strong",
        subtle: "bg-surface-hover text-ink hover:bg-line",
        ghost: "text-muted hover:bg-surface-hover hover:text-ink",
        danger:
          "bg-destructive text-destructive-foreground hover:brightness-110 active:brightness-95",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-2.5 text-[13px] [&_svg]:size-3.5",
        md: "h-9 px-3.5 [&_svg]:size-4",
        lg: "h-10 px-4 [&_svg]:size-4",
        icon: "h-9 w-9 [&_svg]:size-4",
        "icon-sm": "h-7 w-7 [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "brand",
      size: "md",
    },
  }
);

function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
