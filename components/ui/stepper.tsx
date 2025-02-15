import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface StepperProps {
  steps: {
    title: string;
    description?: string;
    icon?: React.ReactNode;
  }[];
  currentStep: number;
  className?: string;
  onStepClick?: (step: number) => void;
  variant?: "default" | "vertical" | "minimal";
}

export function Stepper({
  steps,
  currentStep,
  className,
  onStepClick,
  variant = "default",
}: StepperProps) {
  const isVertical = variant === "vertical";
  const isMinimal = variant === "minimal";

  return (
    <div
      className={cn(
        "w-full",
        isVertical ? "flex flex-col space-y-8" : "relative",
        className,
      )}
      data-oid="r5o_u4t"
    >
      <div
        className={cn(
          "relative",
          isVertical
            ? "flex flex-col space-y-8"
            : "flex justify-between items-center",
        )}
        data-oid="79uqw6w"
      >
        {steps.map((step, index) => {
          const isCompleted = currentStep > index + 1;
          const isCurrent = currentStep === index + 1;
          const isLast = index === steps.length - 1;
          const isClickable =
            onStepClick && (isCompleted || currentStep === index);

          return (
            <React.Fragment key={step.title}>
              <motion.div
                className={cn(
                  "relative flex",
                  isVertical
                    ? "flex-row items-start space-x-4"
                    : "flex-col items-center",
                )}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                data-oid="133mrsz"
              >
                <button
                  onClick={() => isClickable && onStepClick(index + 1)}
                  className={cn(
                    "relative group",
                    isClickable && "cursor-pointer",
                    !isClickable && "cursor-default",
                  )}
                  disabled={!isClickable}
                  data-oid="3:2s32j"
                >
                  {/* Step Circle */}
                  <motion.div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                      isCompleted &&
                        "bg-primary border-primary text-primary-foreground scale-110",
                      isCurrent && "border-primary ring-4 ring-primary/20",
                      !isCompleted &&
                        !isCurrent &&
                        "border-muted hover:border-primary/50",
                      isClickable && "hover:scale-105",
                    )}
                    whileHover={isClickable ? { scale: 1.1 } : {}}
                    whileTap={isClickable ? { scale: 0.95 } : {}}
                    data-oid="8hseudk"
                  >
                    <AnimatePresence mode="wait" data-oid="5y6.osl">
                      {isCompleted ? (
                        <motion.div
                          key="check"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          data-oid="1xwb_bl"
                        >
                          <Check className="h-6 w-6" data-oid="2ytxb:b" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="number"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className={cn(
                            "text-base font-semibold",
                            isCurrent &&
                              "text-primary scale-110 transition-all duration-300",
                            !isCurrent && "text-muted-foreground",
                          )}
                          data-oid="yip.44x"
                        >
                          {step.icon || index + 1}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Progress Tooltip */}
                  {isCurrent && !isMinimal && (
                    <motion.div
                      className="absolute -top-10 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium shadow-lg"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      data-oid="hk97001"
                    >
                      Current Step
                      <div
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-primary"
                        data-oid="t7-nmj8"
                      />
                    </motion.div>
                  )}
                </button>

                {/* Step Content */}
                {!isMinimal && (
                  <motion.div
                    className={cn(
                      "space-y-1",
                      isVertical ? "pt-2" : "mt-4 text-center",
                    )}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.2 }}
                    data-oid="9wr77ow"
                  >
                    <div
                      className={cn(
                        "text-sm font-semibold transition-colors duration-300",
                        (isCompleted || isCurrent) && "text-primary",
                        !isCompleted && !isCurrent && "text-muted-foreground",
                      )}
                      data-oid="tmnlyb6"
                    >
                      {step.title}
                    </div>
                    {step.description && (
                      <div
                        className={cn(
                          "text-xs transition-colors duration-300 max-w-[150px]",
                          isCompleted || isCurrent
                            ? "text-muted-foreground"
                            : "text-muted-foreground/60",
                        )}
                        data-oid="2w9ay3i"
                      >
                        {step.description}
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>

              {/* Connector Line */}
              {!isLast && (
                <div
                  className={cn(
                    "transition-all duration-300",
                    isVertical ? "h-full w-[2px] ml-6 my-2" : "flex-1 mx-4",
                    isMinimal ? "mt-[22px]" : "mt-6",
                  )}
                  data-oid="8i2za9d"
                >
                  <motion.div
                    className={cn(
                      isVertical ? "h-full w-full" : "h-[2px] w-full",
                      "relative",
                    )}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    data-oid="hnenue5"
                  >
                    <div
                      className={cn(
                        "absolute inset-0 transition-all duration-500",
                        isCompleted ? "bg-primary" : "bg-muted",
                      )}
                      data-oid="0ibd746"
                    />

                    {isCompleted && (
                      <motion.div
                        className={cn(
                          "absolute top-1/2 -translate-y-1/2",
                          "text-primary",
                        )}
                        initial={{ right: "100%" }}
                        animate={{ right: "0%" }}
                        transition={{ duration: 0.5 }}
                        data-oid="qx_y0q1"
                      >
                        <ArrowRight className="w-4 h-4" data-oid="4mdouq8" />
                      </motion.div>
                    )}
                  </motion.div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
