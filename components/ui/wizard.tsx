"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "./button";

export interface WizardStep {
  id: string;
  label: string;
  /** Optional description shown below label */
  description?: string;
  /** Custom validation — return true to allow advancing */
  validate?: () => boolean | Promise<boolean>;
  /** Whether this step should be skipped */
  skip?: boolean;
}

interface WizardProps {
  steps: WizardStep[];
  /** Controlled step index */
  currentStep?: number;
  onStepChange?: (step: number) => void;
  /** Called when the final step is completed */
  onComplete?: () => void;
  /** Render content for each step */
  children: (step: WizardStep, index: number) => React.ReactNode;
  className?: string;
  /** Label for the final step's action button */
  completeLabel?: string;
  /** Label for next button */
  nextLabel?: string;
  /** Label for back button */
  backLabel?: string;
  /** Whether the complete/next action is loading */
  loading?: boolean;
  /** Whether the next/complete button should be disabled */
  nextDisabled?: boolean;
  /** Hide the default navigation buttons */
  hideNavigation?: boolean;
  /** Show step numbers instead of checkmarks for completed */
  showStepNumbers?: boolean;
}

export function Wizard({
  steps,
  currentStep: controlledStep,
  onStepChange,
  onComplete,
  children,
  className,
  completeLabel = "Complete",
  nextLabel = "Continue",
  backLabel = "Back",
  loading = false,
  nextDisabled = false,
  hideNavigation = false,
  showStepNumbers = false,
}: WizardProps) {
  const [internalStep, setInternalStep] = useState(0);
  const activeStep = controlledStep ?? internalStep;

  const visibleSteps = steps.filter((s) => !s.skip);
  const visibleIndex = visibleSteps.findIndex(
    (s) => s.id === steps[activeStep]?.id,
  );

  const setStep = useCallback(
    (step: number) => {
      if (onStepChange) {
        onStepChange(step);
      } else {
        setInternalStep(step);
      }
    },
    [onStepChange],
  );

  const handleNext = useCallback(async () => {
    const step = steps[activeStep];
    if (step?.validate) {
      const valid = await step.validate();
      if (!valid) return;
    }

    // Find next non-skipped step
    let next = activeStep + 1;
    while (next < steps.length && steps[next].skip) {
      next++;
    }

    if (next >= steps.length) {
      onComplete?.();
    } else {
      setStep(next);
    }
  }, [activeStep, steps, onComplete, setStep]);

  const handleBack = useCallback(() => {
    // Find previous non-skipped step
    let prev = activeStep - 1;
    while (prev >= 0 && steps[prev].skip) {
      prev--;
    }
    if (prev >= 0) {
      setStep(prev);
    }
  }, [activeStep, steps, setStep]);

  const isLastStep = (() => {
    let next = activeStep + 1;
    while (next < steps.length && steps[next].skip) {
      next++;
    }
    return next >= steps.length;
  })();

  const isFirstStep = (() => {
    let prev = activeStep - 1;
    while (prev >= 0 && steps[prev].skip) {
      prev--;
    }
    return prev < 0;
  })();

  const currentStepData = steps[activeStep];
  if (!currentStepData) return null;

  return (
    <div className={cn("w-full", className)}>
      {/* Progress indicator */}
      <nav aria-label="Wizard progress" className="mb-6">
        <ol className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
          {visibleSteps.map((step, idx) => {
            const isCompleted = idx < visibleIndex;
            const isCurrent = idx === visibleIndex;

            return (
              <li
                key={step.id}
                className={cn(
                  "flex items-center",
                  idx < visibleSteps.length - 1 && "flex-1",
                )}
              >
                <div className="flex flex-col items-center min-w-0">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                      isCompleted &&
                        "bg-emerald-500 text-white",
                      isCurrent &&
                        "bg-[#0066FF] text-white ring-2 ring-[#0066FF]/30",
                      !isCompleted &&
                        !isCurrent &&
                        "bg-muted text-muted-foreground",
                    )}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {isCompleted && !showStepNumbers ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      "mt-1.5 text-xs font-medium text-center leading-tight max-w-[80px] truncate",
                      isCurrent
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < visibleSteps.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 h-0.5 flex-1 min-w-[16px]",
                      isCompleted ? "bg-emerald-500" : "bg-muted",
                    )}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step content */}
      <div className="page-transition">
        {children(currentStepData, activeStep)}
      </div>

      {/* Navigation */}
      {!hideNavigation && (
        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={isFirstStep || loading}
            className="min-h-[44px]"
          >
            {backLabel}
          </Button>
          <Button
            onClick={handleNext}
            disabled={nextDisabled || loading}
            className="min-h-[44px] min-w-[120px]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {isLastStep ? completeLabel : nextLabel}
              </span>
            ) : isLastStep ? (
              completeLabel
            ) : (
              nextLabel
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
