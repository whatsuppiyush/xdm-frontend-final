import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg border-[1.5px] border-gray-200 bg-white px-4 py-2.5 text-base text-gray-900",
          "transition-all duration-200 ease-in-out",
          "placeholder:text-gray-400 placeholder:text-base",
          "hover:border-purple-300 hover:bg-gray-50/50",
          "focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-200 focus:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:bg-white",
          "file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0",
          "file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700",
          "file:hover:bg-purple-100 file:transition-colors",
          className,
        )}
        ref={ref}
        {...props}
        data-oid="l1:b0lc"
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
