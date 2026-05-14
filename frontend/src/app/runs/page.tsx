"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchRuns, fetchBatchStatus } from "@/lib/api";
import type { Run, BatchStatus } from "@/lib/api";
import { formatRelativeTime, formatDuration, shortenId } from "@/lib/utils";
import { Play, Plus, Layers, CheckCircle, XCircle, Clock } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}
    >
      {label}
    </span>
  );
}

function BatchProgressCard({ batch }: { batch: BatchStatus }) {
  const progressPct =
    batch.total > 0 ? Math.round((batch.completed / batch.total) * 100) : 0;

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <Layers className="w-5 h-5 text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Batch {batch.batch_id.slice(0, 8)}
          </h2>
          <p className="text-sm text-slate-500">
            {batch.total} total runs
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-slate-600">Progress</span>
          <span className="text-sm font-medium text-slate-900">{progressPct}%</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          </div>
          <p className="text-lg font-bold text-green-600">{batch.passed}</p>
          <p className="text-xs text-slate-500">Passed</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <XCircle className="w-3.5 h-3.5 text-red-500" />
          </div>
          <p className="text-lg font-bold text-red-600">{batch.failed}</p>
          <p className="text-xs text-slate-500">Failed</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <p className="text-lg font-bold text-slate-600">{batch.pending}</p>
          <p className="text-xs text-slate-500">Pending</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Layers className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <p className="text-lg font-bold text-blue-600">{batch.completed}</p>
          <p className="text-xs text-slate-500">Done</p>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-5 bg-slate-200 rounded w-32" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-12 bg-slate-100 rounded" />
        ))}
      </div>
    </div>
  );
}

export default function RunsPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-96 bg-slate-100 rounded-lg" />}>
      <RunsPageContent />
    </Suspense>
  );
}

function RunsPageContent() {
  const searchParams = useSearchParams();
  const batchId = searchParams.get("batch");

  const { data: runs, isLoading } = useQuery({
    queryKey: ["runs"],
    queryFn: () => fetchRuns(),
  });

  const { data: batchStatus } = useQuery({
    queryKey: ["batch-status", batchId],
    queryFn: () => fetchBatchStatus(batchId!),
    enabled: !!batchId,
    refetchInterval: batchId ? 5000 : false, // Poll every 5s when viewing a batch
  });

  // Filter runs by batch if batch param is present
  const displayedRuns = batchId && batchStatus
    ? batchStatus.runs
    : runs;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {batchId ? "Batch Results" : "Runs"}
          </h1>
          <p className="text-slate-500 mt-1">
            {batchId
              ? `Viewing batch ${batchId.slice(0, 8)} results.`
              : "View and manage evaluation runs."}
          </p>
          {batchId && (
            <Link
              href="/runs"
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              ← View all runs
            </Link>
          )}
        </div>
        <Link
          href="/runs/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Run
        </Link>
      </div>

      {/* Batch progress summary */}
      {batchId && batchStatus && <BatchProgressCard batch={batchStatus} />}

      {isLoading && !batchId ? (
        <LoadingSkeleton />
      ) : !displayedRuns || displayedRuns.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-12 text-center">
          <Play className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">
            {batchId ? "No runs in this batch" : "No runs yet"}
          </h3>
          <p className="text-slate-500 text-sm mb-4">
            {batchId
              ? "The batch has no runs yet. They may still be initializing."
              : "Create a run to start evaluating skills against tasks."}
          </p>
          {!batchId && (
            <Link
              href="/runs/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Run
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-500">
                    ID
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">
                    Task
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">
                    Skill Version
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">
                    Agent
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">
                    Model
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">
                    Reward
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedRuns.map((run) => (
                  <tr
                    key={run.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <Link
                        href={`/runs/${run.id}`}
                        className="font-mono text-xs text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        {shortenId(run.id)}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {run.task_name}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {run.skill_name} v{run.skill_version}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{run.agent}</td>
                    <td className="py-3 px-4 text-slate-600">{run.model}</td>
                    <td className="py-3 px-4">
                      <StatusBadge run={run} />
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {run.reward !== null ? run.reward.toFixed(2) : "-"}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {formatDuration(run.duration_seconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
