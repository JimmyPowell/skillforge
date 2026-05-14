"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchSkills, fetchTasks, createRun } from "@/lib/api";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewRunPage() {
  const router = useRouter();
  const [taskId, setTaskId] = useState("");
  const [skillId, setSkillId] = useState("");
  const [skillVersion, setSkillVersion] = useState<number | undefined>(
    undefined
  );
  const [agent, setAgent] = useState("claude-code");
  const [model, setModel] = useState("claude-sonnet-4-20250514");

  const { data: skills } = useQuery({
    queryKey: ["skills"],
    queryFn: fetchSkills,
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });

  const mutation = useMutation({
    mutationFn: createRun,
    onSuccess: (run) => {
      router.push(`/runs/${run.id}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      task_id: taskId,
      skill_id: skillId,
      skill_version: skillVersion ?? 1,
      agent,
      model,
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link
          href="/runs"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Create New Run</h1>
        <p className="text-slate-500 mt-1">
          Evaluate a skill against a task using an AI agent.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Task <span className="text-red-500">*</span>
            </label>
            <select
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Select a task...</option>
              {tasks?.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name} ({task.difficulty})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Skill <span className="text-red-500">*</span>
            </label>
            <select
              value={skillId}
              onChange={(e) => setSkillId(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Select a skill...</option>
              {skills?.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name} (v{skill.latest_version})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Skill Version
            </label>
            <input
              type="number"
              min={1}
              value={skillVersion ?? ""}
              onChange={(e) =>
                setSkillVersion(
                  e.target.value ? parseInt(e.target.value) : undefined
                )
              }
              placeholder="Latest version"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-slate-400">
              Leave blank to use the latest version.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Agent <span className="text-red-500">*</span>
              </label>
              <select
                value={agent}
                onChange={(e) => setAgent(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="claude-code">Claude Code</option>
                <option value="codex">Codex</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Model <span className="text-red-500">*</span>
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                <option value="claude-opus-4-20250514">Claude Opus 4</option>
                <option value="claude-haiku-4-20250514">Claude Haiku 4</option>
                <option value="gpt-4o">GPT-4o</option>
              </select>
            </div>
          </div>
        </div>

        {mutation.isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">
              Error: {mutation.error.message}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!taskId || !skillId || mutation.isPending}
            className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "Creating..." : "Create Run"}
          </button>
          <Link
            href="/runs"
            className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
