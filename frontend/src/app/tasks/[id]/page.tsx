"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTask } from "@/lib/api";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-slate-200 rounded w-48" />
        <div className="h-4 bg-slate-100 rounded w-96" />
        <div className="h-96 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  let classes = "";
  switch (difficulty.toLowerCase()) {
    case "easy":
      classes = "bg-green-100 text-green-700";
      break;
    case "medium":
      classes = "bg-amber-100 text-amber-700";
      break;
    case "hard":
      classes = "bg-red-100 text-red-700";
      break;
    default:
      classes = "bg-slate-100 text-slate-700";
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}
    >
      {difficulty}
    </span>
  );
}

type TabKey = "instruction" | "dockerfile" | "verifier" | "solution";

export default function TaskDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState<TabKey>("instruction");

  const { data: task, isLoading } = useQuery({
    queryKey: ["task", id],
    queryFn: () => fetchTask(id),
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!task) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Task not found.</p>
        <Link
          href="/tasks"
          className="text-blue-600 hover:underline mt-2 inline-block"
        >
          Back to Tasks
        </Link>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "instruction", label: "Instruction" },
    { key: "dockerfile", label: "Dockerfile" },
    { key: "verifier", label: "Verifier" },
    { key: "solution", label: "Solution" },
  ];

  const tabContent: Record<TabKey, string> = {
    instruction: task.instruction,
    dockerfile: task.dockerfile,
    verifier: task.verifier,
    solution: task.solution,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{task.name}</h1>
          <DifficultyBadge difficulty={task.difficulty} />
        </div>
        <div className="flex items-center gap-3 mt-2">
          {task.category && (
            <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2.5 py-0.5 text-xs font-medium">
              {task.category}
            </span>
          )}
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {tabContent[activeTab] ? (
          <pre className="p-6 text-sm font-mono text-slate-800 bg-slate-50 overflow-x-auto whitespace-pre-wrap break-words">
            {tabContent[activeTab]}
          </pre>
        ) : (
          <div className="p-6 text-center text-slate-400 text-sm">
            No content available for this section.
          </div>
        )}
      </div>
    </div>
  );
}
