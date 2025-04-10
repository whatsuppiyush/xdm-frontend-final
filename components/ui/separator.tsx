"use client";

import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "@/lib/utils";

interface SeparatorProps extends React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> {
  color?: "default" | "muted" | "accent" | "primary";
  thickness?: "thin" | "regular" | "thick";
  spaced?: boolean;
}

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  SeparatorProps
>(
  (
    { 
      className, 
      orientation = "horizontal", 
      decorative = true, 
      color = "default",
      thickness = "regular",
      spaced = false,
      ...props 
    },
    ref,
  ) => {
    const colorClasses = {
      default: "bg-border dark:bg-border",
      muted: "bg-gray-200 dark:bg-gray-800",
      accent: "bg-purple-200 dark:bg-purple-800",
      primary: "bg-purple-500 dark:bg-purple-400",
    };

    const thicknessClasses = {
      thin: orientation === "horizontal" ? "h-px" : "w-px",
      regular: orientation === "horizontal" ? "h-[1px]" : "w-[1px]",
      thick: orientation === "horizontal" ? "h-0.5" : "w-0.5",
    };

    return (
      <SeparatorPrimitive.Root
        ref={ref}
        decorative={decorative}
        orientation={orientation}
        className={cn(
          "shrink-0",
          colorClasses[color],
          thicknessClasses[thickness],
          orientation === "horizontal" ? "w-full" : "h-full",
          spaced && (orientation === "horizontal" ? "my-4" : "mx-4"),
          className,
        )}
        {...props}
        data-oid=".pg-p12"
      />
    );
  },
);
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
