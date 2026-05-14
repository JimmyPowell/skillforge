"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchRun, fetchTrajectory, fetchSkillUsage } from "@/lib/api";
import type { Run } from "@/lib/api";
import { useParams } from "next/navigation";
import { ArrowLeft, Clock, Cpu, FileText, Target, List, Sparkles } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime, formatDuration } from "@/lib/utils";
import TrajectoryTimeline from "@/components/trajectory/TrajectoryTimeline";
import TrajectoryPlayer from "@/components/trajectory/TrajectoryPlayer";
import SkillUsageCard from "@/components/trajectory/SkillUsageCard";

function StatusBadge({ run }: { run: Run }) {
  let classes = "";
  let label = "";

  if (run.status === "pending") {
    classes = "bg-slate-100 text-slate-700";
    label = "Pending";
  } else if (run.status === "building") {
    classes = "bg-blue-100 text-blue-700";
    label = "Building";
  } else if (run.status === "running") {
    classes = "bg-blue-100 text-blue-700";
    label = "Running";
  } else if (run.status === "completed" && run.passed) {
    classes = "bg-green-100 text-green-700";
    label = "Passed";
  } else if (run.status === "completed" && !run.passed) {
    classes = "bg-red-100 text-red-700";
    label = "Failed";
  } else if (run.status === "failed") {
    classes = "bg-red-100 text-red-700";
    label = "Error";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}
    >
      {label}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-slate-200 rounded w-48" />
        <div className="h-4 bg-slate-100 rounded w-96" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-lg" />
          ))}
        </div>
        <div className="h-64 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

function TrajectoryLoadingSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="h-12 bg-slate-100 rounded-lg" />
      ))}
    </div>
  );
}

type Tab = "trajectory" | "skill-usage";

export default function RunDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState<Tab>("trajectory");
  const [currentStep, setCurrentStep] = useState(0);

  const { data: run, isLoading } = useQuery({
    queryKey: ["run", id],
    queryFn: () => fetchRun(id),
  });

  const { data: trajectory, isLoading: trajectoryLoading } = useQuery({
    queryKey: ["trajectory", id],
    queryFn: () => fetchTrajectory(id),
  });

  const { data: skillUsage, isLoading: skillUsageLoading } = useQuery({
    queryKey: ["skill-usage", id],
    queryFn: () => fetchSkillUsage(id),
  });

  const handleStepChange = useCallback((stepOrFn: number | ((prev: number) => number)) => {
    if (typeof stepOrFn === "function") {
      setCurrentStep(stepOrFn);
    } else {
      setCurrentStep(stepOrFn);
    }
  }, []);

  if (isLoading) return <LoadingSkeleton />;
  if (!run) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Run not found.</p>
        <Link
          href="/runs"
          className="text-blue-600 hover:underline mt-2 inline-block"
        >
          Back to Runs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/runs"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Run {id.slice(0, 8)}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Created {formatRelativeTime(run.created_at)}
          </p>
        </div>
        <StatusBadge run={run} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Target className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Task
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-900">
            {run.task_name}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <FileText className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Skill Version
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-900">
            {run.skill_name} v{run.skill_version}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Cpu className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Agent / Model
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-900">
            {run.agent}
          </p>
          <p className="text-xs text-slate-500">{run.model}</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Duration
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-900">
            {formatDuration(run.duration_seconds)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">
            Result
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Status</span>
              <StatusBadge run={run} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Reward</span>
              <span className="text-sm font-semibold text-slate-900">
                {run.reward !== null ? run.reward.toFixed(2) : "-"}
              </span>
            </div>
            {run.started_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Started</span>
                <span className="text-sm text-slate-900">
                  {formatRelativeTime(run.started_at)}
                </span>
              </div>
            )}
            {run.completed_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Completed</span>
                <span className="text-sm text-slate-900">
                  {formatRelativeTime(run.completed_at)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">
            Timing Breakdown
          </h3>
          {run.started_at && run.completed_at ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Queue time</span>
                <span className="text-sm text-slate-900">
                  {formatDuration(
                    (new Date(run.started_at).getTime() -
                      new Date(run.created_at).getTime()) /
                      1000
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Execution time</span>
                <span className="text-sm text-slate-900">
                  {formatDuration(run.duration_seconds)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm font-medium text-slate-700">
                  Total
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  {formatDuration(
                    (new Date(run.completed_at).getTime() -
                      new Date(run.created_at).getTime()) /
                      1000
                  )}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Timing data not yet available.
            </p>
          )}
        </div>
      </div>

      {run.verifier_output && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-sm font-medium text-slate-900">
              Verifier Output
            </h3>
          </div>
          <pre className="p-6 text-sm font-mono text-slate-800 bg-slate-50 overflow-x-auto whitespace-pre-wrap break-words">
            {run.verifier_output}
          </pre>
        </div>
      )}

      {/* Trajectory & Skill Usage Tabs */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200">
          <nav className="flex">
            <button
              type="button"
              onClick={() => setActiveTab("trajectory")}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "trajectory"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <List className="w-4 h-4" />
              Trajectory
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("skill-usage")}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "skill-usage"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Skill Usage
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "trajectory" && (
            <div className="space-y-4">
              {trajectoryLoading ? (
                <TrajectoryLoadingSkeleton />
              ) : trajectory && trajectory.length > 0 ? (
                <>
                  <TrajectoryPlayer
                    totalSteps={trajectory.length}
                    currentStep={currentStep}
                    onStepChange={handleStepChange}
                  />
                  <TrajectoryTimeline
                    events={trajectory}
                    currentStep={trajectory[currentStep]?.step ?? null}
                    onStepClick={(step) => {
                      const idx = trajectory.findIndex((e) => e.step === step);
                      if (idx !== -1) setCurrentStep(idx);
                    }}
                  />
                </>
              ) : (
                <div className="rounded-lg bg-slate-50 border border-dashed border-slate-300 p-8 text-center">
                  <p className="text-sm text-slate-400">
                    No trajectory available for this run.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "skill-usage" && (
            <div>
              {skillUsageLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-slate-100 rounded w-48" />
                  <div className="h-32 bg-slate-100 rounded" />
                </div>
              ) : skillUsage ? (
                <SkillUsageCard analysis={skillUsage} />
              ) : (
                <div className="rounded-lg bg-slate-50 border border-dashed border-slate-300 p-8 text-center">
                  <p className="text-sm text-slate-400">
                    No skill usage data available for this run.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
