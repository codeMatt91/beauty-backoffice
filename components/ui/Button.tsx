import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Raised (3D) buttons: gradient + top highlight + bottom edge + drop shadow.
// Lifts 1px on hover, sinks on press. Ghost and disabled stay flat.
export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border font-semibold select-none",
    "transition-[transform,box-shadow,filter,background-color] duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none aria-busy:cursor-wait",
    "aria-disabled:border-transparent aria-disabled:bg-muted aria-disabled:bg-none aria-disabled:text-muted-foreground aria-disabled:shadow-none aria-disabled:[text-shadow:none]",
    "[&_svg]:size-[18px] [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "border-black/20 bg-primary bg-gradient-to-b from-white/15 via-transparent to-black/10 text-primary-foreground [text-shadow:0_1px_0_rgb(0_0_0/0.2)] shadow-raised-primary hover:-translate-y-px hover:shadow-raised-primary-hover hover:brightness-105 active:translate-y-px active:shadow-pressed active:brightness-95",
        tonal:
          "border-primary/20 bg-accent bg-gradient-to-b from-white/50 to-transparent text-accent-foreground shadow-raised dark:from-white/10 hover:-translate-y-px hover:shadow-raised-hover hover:brightness-[.98] active:translate-y-px active:shadow-pressed",
        outline:
          "border-border bg-card bg-gradient-to-b from-card to-secondary text-foreground shadow-raised hover:-translate-y-px hover:shadow-raised-hover active:translate-y-px active:shadow-pressed",
        ghost:
          "border-transparent bg-transparent text-foreground hover:bg-secondary active:bg-muted",
        destructive:
          "border-black/25 bg-destructive bg-gradient-to-b from-white/10 to-black/10 text-destructive-foreground [text-shadow:0_1px_0_rgb(0_0_0/0.2)] shadow-raised-danger hover:-translate-y-px hover:brightness-105 active:translate-y-px active:shadow-pressed active:brightness-95",
        destructiveSoft:
          "border-red-200 bg-red-50 bg-gradient-to-b from-white/60 to-red-100 text-red-800 shadow-raised dark:border-red-900 dark:bg-red-950 dark:from-red-900/40 dark:to-red-950 dark:text-red-200 hover:-translate-y-px hover:shadow-raised-hover active:translate-y-px active:shadow-pressed",
      },
      size: {
        sm: "h-9 rounded-lg px-3.5 text-sm",
        md: "h-11 rounded-xl px-5 text-[15px]",
        lg: "h-[52px] rounded-xl px-6 text-base",
        icon: "size-11 rounded-xl p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Shows a spinner and blocks clicks while keeping the variant's colors. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, disabled, type = "button", children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-disabled={disabled || undefined}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
