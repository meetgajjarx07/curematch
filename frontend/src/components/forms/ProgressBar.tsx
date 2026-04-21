"use client";

import { motion } from "framer-motion";

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

export default function ProgressBar({ currentStep, labels }: ProgressBarProps) {
  return (
    <div className="mb-10">
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-3">
        {labels.map((label, i) => (
          <div key={i} className="flex flex-col items-center flex-1">
            <div className="flex items-center w-full">
              {i > 0 && (
                <div className="flex-1 h-[2px] bg-white/[0.06]">
                  <motion.div
                    className="h-full bg-blue-500"
                    initial={{ width: "0%" }}
                    animate={{ width: i <= currentStep ? "100%" : "0%" }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                  />
                </div>
              )}
              <motion.div
                className={`relative flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${
                  i <= currentStep
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "bg-bg-elevated border-white/[0.08] text-text-secondary"
                }`}
                animate={i === currentStep ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {i < currentStep ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </motion.div>
              {i < labels.length - 1 && i >= 0 && (
                <div className="flex-1 h-[2px] bg-white/[0.06]">
                  <motion.div
                    className="h-full bg-blue-500"
                    initial={{ width: "0%" }}
                    animate={{ width: i < currentStep ? "100%" : "0%" }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                  />
                </div>
              )}
            </div>
            <span
              className={`mt-2 text-[11px] font-medium hidden sm:block ${
                i <= currentStep ? "text-white" : "text-text-secondary"
              }`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Mobile current step label */}
      <div className="sm:hidden text-center">
        <span className="text-sm font-medium text-blue-400">
          Step {currentStep + 1}: {labels[currentStep]}
        </span>
      </div>
    </div>
  );
}
