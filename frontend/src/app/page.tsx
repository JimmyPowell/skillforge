"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchSkills,
  fetchTasks,
  fetchRuns,
  fetchDashboardAnalytics,
} from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import { Activity, BookOpen, ClipboardList, TrendingUp } from "lucide-react";
import type { Run } from "@/lib/api";

function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ run }: { run: Run }) {
  let className =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ";
  if (run.status === "pending") {
    className += "bg-slate-100 text-slate-700";
  } else if (run.status === "building" || run.status === "running") {
    className += "bg-blue-100 text-blue-700";
  } else if (run.status === "completed" && run.passed) {
    className += "bg-green-100 text-green-700";
  } else if (run.status === "completed" && !run.passed) {
    className += "bg-red-100 text-red-700";
  } else if (run.status === "failed") {
    className += "bg-red-100 text-red-700";
  }

  let label: string = run.status;
  if (run.status === "completed") {
    label = run.passed ? "passed" : "failed";
  }

  return <span className={className}>{label}</span>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-lg border border-slate-200 shadow-sm p-6"
          >
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-slate-200 rounded w-24" />
              <div className="h-8 bg-slate-200 rounded w-16" />
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-slate-200 rounded w-32" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: fetchDashboardAnalytics,
  });

  const { data: skills, isLoading: skillsLoading } = useQuery({
    queryKey: ["skills"],
    queryFn: fetchSkills,
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ["runs"],
    queryFn: () => fetchRuns({ limit: 20 }),
  });

  const isLoading = skillsLoading || tasksLoading || runsLoading || dashboardLoading;

  if (isLoading) return <LoadingSkeleton />;

  const totalSkills = dashboard?.total_skills ?? skills?.length ?? 0;
  const totalTasks = dashboard?.total_tasks ?? tasks?.length ?? 0;
  const totalRuns = dashboard?.total_runs ?? runs?.length ?? 0;
  const passRate = dashboard?.pass_rate ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">
          Overview of your skills, tasks, and evaluation runs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Skills"
          value={totalSkills}
          icon={BookOpen}
          color="bg-blue-500"
        />
        <StatCard
          label="Total Tasks"
          value={totalTasks}
          icon={ClipboardList}
          color="bg-purple-500"
        />
        <StatCard
          label="Total Runs"
          value={totalRuns}
          subtitle={`${Math.round(passRate)}% pass rate`}
          icon={Activity}
          color="bg-amber-500"
        />
        <StatCard
          label="Pass Rate"
          value={`${Math.round(passRate)}%`}
          icon={TrendingUp}
          color="bg-green-500"
        />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Recent Runs
        </h2>
        {!runs || runs.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">
              No runs yet. Create a run to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-2 font-medium text-slate-500">
                    Task
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-slate-500">
                    Skill
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-slate-500">
                    Agent
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-slate-500">
                    Status
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-slate-500">
                    Reward
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-slate-500">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 10).map((run) => (
                  <tr
                    key={run.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-3 px-2 text-slate-900">
                      {run.task_name}
                    </td>
                    <td className="py-3 px-2 text-slate-600">
                      {run.skill_name}
                    </td>
                    <td className="py-3 px-2 text-slate-600">{run.agent}</td>
                    <td className="py-3 px-2">
                      <StatusBadge run={run} />
                    </td>
                    <td className="py-3 px-2 text-slate-600">
                      {run.reward !== null ? run.reward.toFixed(2) : "-"}
                    </td>
                    <td className="py-3 px-2 text-slate-500 text-xs">
                      {formatRelativeTime(run.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
