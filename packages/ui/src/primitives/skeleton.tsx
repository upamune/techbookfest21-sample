import * as React from "react";
import { cn } from "cn";

function Skeleton({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-accent", className)}
      {...props}
    />
  );
}

export { Skeleton };
