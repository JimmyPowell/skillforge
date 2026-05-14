"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchDashboardAnalytics,
  fetchSkillTrends,
  fetchTokenSummary,
  fetchSkills,
  fetchRuns,
} from "@/lib/api";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Activity,
  TrendingUp,
  Eye,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { Run } from "@/lib/api";

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

export default function AnalyticsPage() {
  const [selectedSkillId, setSelectedSkillId] = useState<string>("");

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: fetchDashboardAnalytics,
  });

  const { data: skills } = useQuery({
    queryKey: ["skills"],
    queryFn: fetchSkills,
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ["skill-trends", selectedSkillId],
    queryFn: () => fetchSkillTrends(selectedSkillId),
    enabled: !!selectedSkillId,
  });

  const { data: tokenSummary, isLoading: tokensLoading } = useQuery({
    queryKey: ["token-summary"],
    queryFn: () => fetchTokenSummary("skill"),
  });

  const { data: recentRuns } = useQuery({
    queryKey: ["runs-recent"],
    queryFn: () => fetchRuns({ limit: 10 }),
  });

  if (dashboardLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 mt-1">
            Performance insights and metrics.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-lg border border-slate-200 shadow-sm p-6"
            >
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-slate-200 rounded w-20" />
                <div className="h-8 bg-slate-200 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-lg border border-slate-200 shadow-sm p-6"
            >
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-slate-200 rounded w-32" />
                <div className="h-48 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 mt-1">
          Performance insights and metrics across your evaluation runs.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Skills</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {dashboard?.total_skills ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Tasks</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {dashboard?.total_tasks ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-purple-500">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Runs</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {dashboard?.total_runs ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500">
              <Activity className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Pass Rate</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {dashboard?.pass_rate !== undefined
                  ? `${Math.round(dashboard.pass_rate)}%`
                  : "0%"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-500">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Skill Read Rate
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {dashboard?.skill_read_rate !== undefined
                  ? `${Math.round(dashboard.skill_read_rate)}%`
                  : "0%"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-cyan-500">
              <Eye className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pass Rate Trend Chart */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-900">
              Pass Rate Trend by Version
            </h3>
            <select
              value={selectedSkillId}
              onChange={(e) => setSelectedSkillId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a skill...</option>
              {skills?.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
                </option>
              ))}
            </select>
          </div>
          {!selectedSkillId ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              Select a skill to view its pass rate trend
            </div>
          ) : trendsLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-pulse h-48 w-full bg-slate-100 rounded" />
            </div>
          ) : trends && trends.trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trends.trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="version"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `v${v}`}
                  stroke="#94a3b8"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  stroke="#94a3b8"
                />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, "Pass Rate"]}
                  labelFormatter={(label) => `Version ${label}`}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="pass_rate"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "#2563eb" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              No trend data available for this skill
            </div>
          )}
        </div>

        {/* Token Usage Chart */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-medium text-slate-900 mb-4">
            Token Usage by Skill
          </h3>
          {tokensLoading ? (
            <div className="animate-pulse h-48 w-full bg-slate-100 rounded" />
          ) : tokenSummary && tokenSummary.items.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={tokenSummary.items}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  stroke="#94a3b8"
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                  }
                />
                <Tooltip
                  formatter={(value) => [
                    Number(value).toLocaleString(),
                    "Tokens",
                  ]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar
                  dataKey="prompt_tokens"
                  name="Prompt"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  stackId="stack"
                />
                <Bar
                  dataKey="completion_tokens"
                  name="Completion"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  stackId="stack"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              No token usage data available
            </div>
          )}
        </div>
      </div>

      {/* Recent Runs Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-medium text-slate-900 mb-4">
          Recent Runs
        </h3>
        {!recentRuns || recentRuns.length === 0 ? (
          <div className="text-center py-8">
            <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No runs yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 font-medium text-slate-500">
                    Task
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-slate-500">
                    Skill
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-slate-500">
                    Agent
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-slate-500">
                    Status
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-slate-500">
                    Reward
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-slate-500">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentRuns.slice(0, 10).map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2 text-slate-900">
                      {run.task_name}
                    </td>
                    <td className="py-2 px-2 text-slate-600">
                      {run.skill_name}
                    </td>
                    <td className="py-2 px-2 text-slate-600">{run.agent}</td>
                    <td className="py-2 px-2">
                      <StatusBadge run={run} />
                    </td>
                    <td className="py-2 px-2 text-slate-600">
                      {run.reward !== null ? run.reward.toFixed(2) : "-"}
                    </td>
                    <td className="py-2 px-2 text-slate-500 text-xs">
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
