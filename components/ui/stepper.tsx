import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface StepperProps {
  steps: {
    title: string;
    description?: string;
  }[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="relative flex justify-between">
        {steps.map((step, index) => {
          const isCompleted = currentStep > index + 1;
          const isCurrent = currentStep === index + 1;
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.title}>
              <div className="flex flex-col items-center relative">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center border-2',
                    isCompleted && 'bg-primary border-primary text-primary-foreground',
                    isCurrent && 'border-primary',
                    !isCompleted && !isCurrent && 'border-muted'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className={cn(
                      'text-sm font-medium',
                      isCurrent && 'text-primary',
                      !isCurrent && 'text-muted-foreground'
                    )}>
                      {index + 1}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div className={cn(
                    'text-sm font-medium',
                    (isCompleted || isCurrent) && 'text-primary',
                    !isCompleted && !isCurrent && 'text-muted-foreground'
                  )}>
                    {step.title}
                  </div>
                  {step.description && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {step.description}
                    </div>
                  )}
                </div>
              </div>
              {!isLast && (
                <div className="flex-1 mt-4">
                  <div
                    className={cn(
                      'h-[2px] w-full',
                      isCompleted ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
} 