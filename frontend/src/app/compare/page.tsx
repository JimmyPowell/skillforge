"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchRuns, fetchRunComparison } from "@/lib/api";
import type { RunComparison } from "@/lib/api";
import { ArrowLeftRight, ArrowRight, GitCompare } from "lucide-react";
import Link from "next/link";

function ComparisonCard({
  label,
  side,
  otherSide,
}: {
  label: string;
  side: RunComparison["run_a"];
  otherSide: RunComparison["run_b"];
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
        {label}
      </h3>
      <div className="space-y-3">
        <div>
          <p className="text-xs text-slate-500">Task</p>
          <p className="text-sm font-medium text-slate-900">{side.task_name}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Skill</p>
          <p className="text-sm font-medium text-slate-900">
            {side.skill_name} (v{side.skill_version})
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Reward</p>
          <p
            className={`text-lg font-bold ${
              side.reward !== null && otherSide.reward !== null
                ? side.reward > otherSide.reward
                  ? "text-green-600"
                  : side.reward < otherSide.reward
                    ? "text-red-600"
                    : "text-slate-900"
                : "text-slate-900"
            }`}
          >
            {side.reward !== null ? side.reward.toFixed(2) : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Status</p>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              side.passed
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {side.passed ? "passed" : "failed"}
          </span>
        </div>
        <div>
          <p className="text-xs text-slate-500">Duration</p>
          <p
            className={`text-sm font-medium ${
              side.duration_seconds !== null &&
              otherSide.duration_seconds !== null
                ? side.duration_seconds < otherSide.duration_seconds
                  ? "text-green-600"
                  : side.duration_seconds > otherSide.duration_seconds
                    ? "text-red-600"
                    : "text-slate-900"
                : "text-slate-900"
            }`}
          >
            {side.duration_seconds !== null
              ? `${side.duration_seconds.toFixed(1)}s`
              : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Tool Calls</p>
          <p
            className={`text-sm font-medium ${
              side.tool_calls < otherSide.tool_calls
                ? "text-green-600"
                : side.tool_calls > otherSide.tool_calls
                  ? "text-red-600"
                  : "text-slate-900"
            }`}
          >
            {side.tool_calls}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Token Usage</p>
          <p
            className={`text-sm font-medium ${
              side.token_usage < otherSide.token_usage
                ? "text-green-600"
                : side.token_usage > otherSide.token_usage
                  ? "text-red-600"
                  : "text-slate-900"
            }`}
          >
            {side.token_usage.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Skill Read</p>
          <p className="text-sm font-medium text-slate-900">
            {side.skill_read ? "Yes" : "No"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [runAId, setRunAId] = useState("");
  const [runBId, setRunBId] = useState("");
  const [comparisonRequested, setComparisonRequested] = useState(false);

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ["runs"],
    queryFn: () => fetchRuns({ limit: 100 }),
  });

  const {
    data: comparison,
    isLoading: compLoading,
    error: compError,
  } = useQuery({
    queryKey: ["comparison", runAId, runBId],
    queryFn: () => fetchRunComparison(runAId, runBId),
    enabled: comparisonRequested && !!runAId && !!runBId,
  });

  const handleCompare = () => {
    if (runAId && runBId) {
      setComparisonRequested(true);
    }
  };

  const showSkillDiffLink =
    comparison &&
    comparison.run_a.skill_name === comparison.run_b.skill_name &&
    comparison.run_a.skill_version !== comparison.run_b.skill_version;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Compare Runs</h1>
        <p className="text-slate-500 mt-1">
          Side-by-side comparison of evaluation runs.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row items-end gap-4">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Run A
            </label>
            <select
              value={runAId}
              onChange={(e) => {
                setRunAId(e.target.value);
                setComparisonRequested(false);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a run...</option>
              {runs?.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.task_name} / {run.skill_name} v{run.skill_version} -{" "}
                  {run.status === "completed"
                    ? run.passed
                      ? "passed"
                      : "failed"
                    : run.status}
                </option>
              ))}
            </select>
          </div>
          <div className="hidden md:flex items-center justify-center pb-1">
            <ArrowLeftRight className="w-5 h-5 text-slate-400" />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Run B
            </label>
            <select
              value={runBId}
              onChange={(e) => {
                setRunBId(e.target.value);
                setComparisonRequested(false);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a run...</option>
              {runs?.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.task_name} / {run.skill_name} v{run.skill_version} -{" "}
                  {run.status === "completed"
                    ? run.passed
                      ? "passed"
                      : "failed"
                    : run.status}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCompare}
            disabled={!runAId || !runBId || runAId === runBId}
            className="inline-flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GitCompare className="w-4 h-4" />
            Compare
          </button>
        </div>
        {runAId && runBId && runAId === runBId && (
          <p className="text-sm text-amber-600 mt-2">
            Please select two different runs to compare.
          </p>
        )}
      </div>

      {compLoading && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-slate-200 rounded w-48 mx-auto" />
            <div className="h-48 bg-slate-100 rounded" />
          </div>
        </div>
      )}

      {compError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">
            Failed to load comparison: {(compError as Error).message}
          </p>
        </div>
      )}

      {comparison && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ComparisonCard
              label="Run A"
              side={comparison.run_a}
              otherSide={comparison.run_b}
            />
            <ComparisonCard
              label="Run B"
              side={comparison.run_b}
              otherSide={comparison.run_a}
            />
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Delta Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Reward Diff</p>
                <p
                  className={`text-lg font-bold ${
                    (comparison.run_a.reward ?? 0) -
                      (comparison.run_b.reward ?? 0) >
                    0
                      ? "text-green-600"
                      : (comparison.run_a.reward ?? 0) -
                            (comparison.run_b.reward ?? 0) <
                          0
                        ? "text-red-600"
                        : "text-slate-900"
                  }`}
                >
                  {(
                    (comparison.run_a.reward ?? 0) -
                    (comparison.run_b.reward ?? 0)
                  ).toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Tool Calls Diff</p>
                <p
                  className={`text-lg font-bold ${
                    comparison.run_a.tool_calls - comparison.run_b.tool_calls < 0
                      ? "text-green-600"
                      : comparison.run_a.tool_calls -
                            comparison.run_b.tool_calls >
                          0
                        ? "text-red-600"
                        : "text-slate-900"
                  }`}
                >
                  {comparison.run_a.tool_calls - comparison.run_b.tool_calls > 0
                    ? "+"
                    : ""}
                  {comparison.run_a.tool_calls - comparison.run_b.tool_calls}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Duration Diff</p>
                <p
                  className={`text-lg font-bold ${
                    (comparison.run_a.duration_seconds ?? 0) -
                      (comparison.run_b.duration_seconds ?? 0) <
                    0
                      ? "text-green-600"
                      : (comparison.run_a.duration_seconds ?? 0) -
                            (comparison.run_b.duration_seconds ?? 0) >
                          0
                        ? "text-red-600"
                        : "text-slate-900"
                  }`}
                >
                  {(comparison.run_a.duration_seconds ?? 0) -
                    (comparison.run_b.duration_seconds ?? 0) >
                  0
                    ? "+"
                    : ""}
                  {(
                    (comparison.run_a.duration_seconds ?? 0) -
                    (comparison.run_b.duration_seconds ?? 0)
                  ).toFixed(1)}
                  s
                </p>
              </div>
            </div>
          </div>

          {showSkillDiffLink && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">
                  These runs used different versions of{" "}
                  {comparison.run_a.skill_name}
                </p>
                <p className="text-xs text-blue-700 mt-0.5">
                  v{comparison.run_a.skill_version} vs v
                  {comparison.run_b.skill_version}
                </p>
              </div>
              <Link
                href={`/skills/${runs?.find((r) => r.id === runAId)?.skill_id}?tab=diff&v1=${comparison.run_a.skill_version}&v2=${comparison.run_b.skill_version}`}
                className="inline-flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                View Skill Diff
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </>
      )}

      {!comparisonRequested && !compLoading && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-12 text-center">
          <GitCompare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">
            Select two runs to compare
          </h3>
          <p className="text-slate-500 text-sm">
            Choose Run A and Run B from the dropdowns above, then click Compare.
          </p>
        </div>
      )}
    </div>
  );
}
