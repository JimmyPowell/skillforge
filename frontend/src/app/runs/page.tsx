"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchRuns } from "@/lib/api";
import type { Run } from "@/lib/api";
import { formatRelativeTime, formatDuration, shortenId } from "@/lib/utils";
import { Play, Plus } from "lucide-react";
import Link from "next/link";

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
  const { data: runs, isLoading } = useQuery({
    queryKey: ["runs"],
    queryFn: () => fetchRuns(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Runs</h1>
          <p className="text-slate-500 mt-1">
            View and manage evaluation runs.
          </p>
        </div>
        <Link
          href="/runs/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Run
        </Link>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : !runs || runs.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-12 text-center">
          <Play className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">
            No runs yet
          </h3>
          <p className="text-slate-500 text-sm mb-4">
            Create a run to start evaluating skills against tasks.
          </p>
          <Link
            href="/runs/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Run
          </Link>
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
                {runs.map((run) => (
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
