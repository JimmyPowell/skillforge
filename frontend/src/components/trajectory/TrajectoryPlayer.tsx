"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

interface TrajectoryPlayerProps {
  totalSteps: number;
  currentStep: number;
  onStepChange: (step: number | ((prev: number) => number)) => void;
}

export default function TrajectoryPlayer({
  totalSteps,
  currentStep,
  onStepChange,
}: TrajectoryPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const play = useCallback(() => {
    if (currentStep >= totalSteps - 1) {
      // Start from beginning if at end
      onStepChange(0);
    }
    setIsPlaying(true);
  }, [currentStep, totalSteps, onStepChange]);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        onStepChange((prev: number) => {
          const next = prev + 1;
          if (next >= totalSteps) {
            stop();
            return prev;
          }
          return next;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, totalSteps, stop, onStepChange]);

  const goToPrev = () => {
    stop();
    if (currentStep > 0) {
      onStepChange(currentStep - 1);
    }
  };

  const goToNext = () => {
    stop();
    if (currentStep < totalSteps - 1) {
      onStepChange(currentStep + 1);
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      stop();
    } else {
      play();
    }
  };

  if (totalSteps === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
      <button
        type="button"
        onClick={goToPrev}
        disabled={currentStep <= 0}
        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Previous step"
      >
        <SkipBack className="w-4 h-4" />
      </button>

      <div className="text-sm font-medium text-slate-700 min-w-[120px] text-center">
        Step {currentStep + 1} of {totalSteps}
      </div>

      <button
        type="button"
        onClick={goToNext}
        disabled={currentStep >= totalSteps - 1}
        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Next step"
      >
        <SkipForward className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-slate-200 mx-1" />

      <button
        type="button"
        onClick={togglePlay}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          isPlaying
            ? "bg-red-50 text-red-700 hover:bg-red-100"
            : "bg-blue-50 text-blue-700 hover:bg-blue-100"
        }`}
      >
        {isPlaying ? (
          <>
            <Pause className="w-3.5 h-3.5" />
            Pause
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5" />
            Play
          </>
        )}
      </button>

      {/* Progress bar */}
      <div className="flex-1 ml-3">
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
