import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

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
  return (
    <div
      className={cn("w-full bg-white rounded-lg shadow-sm", className)}
      data-oid=":780bk-"
    >
      <div
        className="grid grid-cols-4 divide-x divide-gray-100"
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
                "relative group p-6 transition-all duration-300",
                "hover:bg-gray-50/80",
                isActive && "bg-gray-50",
                isPast && "cursor-pointer",
                isFuture && "cursor-not-allowed opacity-50",
              )}
              data-oid="rf0np8w"
            >
              {/* Active Indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute inset-x-0 -bottom-[2px] h-[2px] bg-primary"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  data-oid="p09a4bx"
                />
              )}

              <div className="flex items-start space-x-4" data-oid="rvfv8_j">
                {/* Step Number or Status */}
                <div
                  className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                    isActive && "bg-primary text-white",
                    isPast && "bg-primary/10 text-primary",
                    isFuture && "bg-gray-100 text-gray-400",
                  )}
                  data-oid="-ow3y6."
                >
                  {stepNumber}
                </div>

                {/* Step Content */}
                <div className="flex-grow text-left" data-oid="jyw4.eg">
                  <div
                    className={cn(
                      "text-sm font-semibold mb-1",
                      isActive && "text-primary",
                      isFuture && "text-gray-400",
                    )}
                    data-oid="mv-idch"
                  >
                    {step.title}
                  </div>
                  {step.subtitle && (
                    <div
                      className="text-xs text-gray-500 line-clamp-2"
                      data-oid="q4fb07u"
                    >
                      {step.subtitle}
                    </div>
                  )}
                </div>

                {/* Arrow Indicator */}
                <ChevronRight
                  className={cn(
                    "w-5 h-5 flex-shrink-0 transition-transform",
                    isActive && "text-primary",
                    "group-hover:translate-x-1",
                    isFuture && "text-gray-300",
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
