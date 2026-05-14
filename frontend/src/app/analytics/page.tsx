"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchRuns, fetchSkills, fetchTasks } from "@/lib/api";
import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ["runs"],
    queryFn: () => fetchRuns(),
  });

  const { data: skills, isLoading: skillsLoading } = useQuery({
    queryKey: ["skills"],
    queryFn: fetchSkills,
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });

  const isLoading = runsLoading || skillsLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 mt-1">
            Performance insights and metrics.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-lg border border-slate-200 shadow-sm p-6"
            >
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-slate-200 rounded w-32" />
                <div className="h-32 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const completedRuns = runs?.filter((r) => r.status === "completed") ?? [];
  const passedRuns = completedRuns.filter((r) => r.passed);
  const failedRuns = completedRuns.filter((r) => !r.passed);
  const passRate =
    completedRuns.length > 0
      ? Math.round((passedRuns.length / completedRuns.length) * 100)
      : 0;

  const avgReward =
    completedRuns.length > 0
      ? (
          completedRuns.reduce((sum, r) => sum + (r.reward ?? 0), 0) /
          completedRuns.length
        ).toFixed(2)
      : "0.00";

  const avgDuration =
    completedRuns.filter((r) => r.duration_seconds !== null).length > 0
      ? (
          completedRuns
            .filter((r) => r.duration_seconds !== null)
            .reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0) /
          completedRuns.filter((r) => r.duration_seconds !== null).length
        ).toFixed(1)
      : "0";

  // Group runs by skill
  const runsBySkill: Record<string, { passed: number; failed: number }> = {};
  completedRuns.forEach((run) => {
    const key = run.skill_name || "Unknown";
    if (!runsBySkill[key]) runsBySkill[key] = { passed: 0, failed: 0 };
    if (run.passed) runsBySkill[key].passed++;
    else runsBySkill[key].failed++;
  });

  // Group runs by task difficulty (using task_name for now)
  const runsByTask: Record<string, { passed: number; failed: number }> = {};
  completedRuns.forEach((run) => {
    const key = run.task_name || "Unknown";
    if (!runsByTask[key]) runsByTask[key] = { passed: 0, failed: 0 };
    if (run.passed) runsByTask[key].passed++;
    else runsByTask[key].failed++;
  });

  const statusCounts = {
    pending: runs?.filter((r) => r.status === "pending").length ?? 0,
    running:
      (runs?.filter((r) => r.status === "running").length ?? 0) +
      (runs?.filter((r) => r.status === "building").length ?? 0),
    completed: completedRuns.length,
    failed: runs?.filter((r) => r.status === "failed").length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 mt-1">
          Performance insights and metrics across your evaluation runs.
        </p>
      </div>

      {!runs || runs.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-12 text-center">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">
            No data yet
          </h3>
          <p className="text-slate-500 text-sm">
            Complete some evaluation runs to see analytics here.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <p className="text-sm font-medium text-slate-500">Pass Rate</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {passRate}%
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {passedRuns.length} of {completedRuns.length} runs
              </p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <p className="text-sm font-medium text-slate-500">Avg Reward</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {avgReward}
              </p>
              <p className="text-xs text-slate-400 mt-1">across completed runs</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <p className="text-sm font-medium text-slate-500">Avg Duration</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {avgDuration}s
              </p>
              <p className="text-xs text-slate-400 mt-1">execution time</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <p className="text-sm font-medium text-slate-500">Total Runs</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {runs?.length ?? 0}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {statusCounts.pending} pending, {statusCounts.running} active
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-medium text-slate-900 mb-4">
                Run Status Distribution
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500" />
                    Passed
                  </span>
                  <span className="text-sm font-medium text-slate-900">
                    {passedRuns.length}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${runs.length > 0 ? (passedRuns.length / runs.length) * 100 : 0}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500" />
                    Failed
                  </span>
                  <span className="text-sm font-medium text-slate-900">
                    {failedRuns.length}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{
                      width: `${runs.length > 0 ? (failedRuns.length / runs.length) * 100 : 0}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    In Progress
                  </span>
                  <span className="text-sm font-medium text-slate-900">
                    {statusCounts.running}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{
                      width: `${runs.length > 0 ? (statusCounts.running / runs.length) * 100 : 0}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-slate-400" />
                    Pending
                  </span>
                  <span className="text-sm font-medium text-slate-900">
                    {statusCounts.pending}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-slate-400 h-2 rounded-full"
                    style={{
                      width: `${runs.length > 0 ? (statusCounts.pending / runs.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-medium text-slate-900 mb-4">
                Pass Rate by Skill
              </h3>
              {Object.keys(runsBySkill).length === 0 ? (
                <p className="text-sm text-slate-400">No completed runs yet.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(runsBySkill).map(([skill, counts]) => {
                    const total = counts.passed + counts.failed;
                    const rate = Math.round((counts.passed / total) * 100);
                    return (
                      <div key={skill}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-700 truncate max-w-[60%]">
                            {skill}
                          </span>
                          <span className="text-xs text-slate-500">
                            {rate}% ({counts.passed}/{total})
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-medium text-slate-900 mb-4">
              Results by Task
            </h3>
            {Object.keys(runsByTask).length === 0 ? (
              <p className="text-sm text-slate-400">No completed runs yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-2 font-medium text-slate-500">
                        Task
                      </th>
                      <th className="text-left py-2 px-2 font-medium text-slate-500">
                        Passed
                      </th>
                      <th className="text-left py-2 px-2 font-medium text-slate-500">
                        Failed
                      </th>
                      <th className="text-left py-2 px-2 font-medium text-slate-500">
                        Pass Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(runsByTask).map(([task, counts]) => {
                      const total = counts.passed + counts.failed;
                      const rate = Math.round((counts.passed / total) * 100);
                      return (
                        <tr key={task} className="hover:bg-slate-50">
                          <td className="py-2 px-2 text-slate-900">{task}</td>
                          <td className="py-2 px-2 text-green-600">
                            {counts.passed}
                          </td>
                          <td className="py-2 px-2 text-red-600">
                            {counts.failed}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-100 rounded-full h-1.5">
                                <div
                                  className="bg-blue-500 h-1.5 rounded-full"
                                  style={{ width: `${rate}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500">
                                {rate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
