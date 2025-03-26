import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";

interface StepsNavigationProps {
  steps: {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
  }[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  className?: string;
}

export function StepsNavigation({
  steps,
  currentStep,
  onStepClick,
  className,
}: StepsNavigationProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className={cn(
        "w-full rounded-lg",
        isDark ? "bg-gray-800 shadow-md" : "bg-white shadow-sm",
        className
      )}
      data-oid=":780bk-"
    >
      <div
        className={cn(
          "grid grid-cols-4 overflow-x-auto",
          isDark ? "divide-x divide-gray-700" : "divide-x divide-gray-100"
        )}
        data-oid="0m3kq:1"
      >
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = currentStep === stepNumber;
          const isPast = currentStep > stepNumber;
          const isFuture = currentStep < stepNumber;

          return (
            <button
              key={step.title}
              onClick={() => onStepClick?.(stepNumber)}
              disabled={isFuture}
              className={cn(
                "relative group p-2 sm:p-4 md:p-6 transition-all duration-300",
                isDark 
                  ? "hover:bg-gray-700" 
                  : "hover:bg-gray-50/80",
                isActive && (isDark ? "bg-gray-700" : "bg-gray-50"),
                isPast && "cursor-pointer",
                isFuture && "cursor-not-allowed opacity-50",
              )}
              data-oid="rf0np8w"
            >
              {/* Active Indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className={cn(
                    "absolute inset-x-0 -bottom-[2px] h-[2px]",
                    isDark ? "bg-purple-500" : "bg-primary"
                  )}
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  data-oid="p09a4bx"
                />
              )}

              <div className="flex items-start space-x-4" data-oid="rvfv8_j">
                {/* Step Number or Status */}
                <div
                  className={cn(
                    "flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-colors",
                    isActive && (isDark 
                      ? "bg-purple-600 text-white shadow-sm shadow-purple-900/50" 
                      : "bg-primary text-white"),
                    isPast && (isDark 
                      ? "bg-purple-900/40 text-purple-300" 
                      : "bg-primary/10 text-primary"),
                    isFuture && (isDark 
                      ? "bg-gray-700 text-gray-400 border border-gray-600" 
                      : "bg-gray-100 text-gray-400"),
                  )}
                  data-oid="-ow3y6."
                >
                  {stepNumber}
                </div>

                {/* Step Content */}
                <div className="flex-grow text-left" data-oid="jyw4.eg">
                  <div
                    className={cn(
                      "text-xs sm:text-sm font-semibold mb-0 sm:mb-1",
                      isActive && (isDark ? "text-purple-400" : "text-primary"),
                      isPast && (isDark ? "text-gray-300" : "text-gray-700"),
                      isFuture && (isDark ? "text-gray-500" : "text-gray-400"),
                    )}
                    data-oid="mv-idch"
                  >
                    {step.title}
                  </div>
                  {step.subtitle && (
                    <div
                      className={cn(
                        "text-[10px] sm:text-xs line-clamp-1 sm:line-clamp-2 hidden xs:block",
                        isDark ? "text-gray-400" : "text-gray-500"
                      )}
                      data-oid="q4fb07u"
                    >
                      {step.subtitle}
                    </div>
                  )}
                </div>

                {/* Arrow Indicator */}
                <ChevronRight
                  className={cn(
                    "w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 transition-transform hidden sm:block",
                    isActive && (isDark ? "text-purple-400" : "text-primary"),
                    "group-hover:translate-x-1",
                    isFuture && (isDark ? "text-gray-600" : "text-gray-300"),
                  )}
                  data-oid="ozx-exr"
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
