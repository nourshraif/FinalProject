import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-vertex-border bg-vertex-card px-3 py-2 text-sm text-vertex-white ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-vertex-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vertex-purple focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
