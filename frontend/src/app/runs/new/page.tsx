"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  fetchSkills,
  fetchTasks,
  createRun,
  fetchAgents,
  fetchAgentModels,
  createBatchRun,
} from "@/lib/api";
import type { SkillVersion } from "@/lib/api";
import { useRouter } from "next/navigation";
import { ArrowLeft, Layers } from "lucide-react";
import Link from "next/link";

export default function NewRunPage() {
  const router = useRouter();

  // Single mode state
  const [taskId, setTaskId] = useState("");
  const [skillId, setSkillId] = useState("");
  const [skillVersion, setSkillVersion] = useState<number | undefined>(undefined);
  const [agent, setAgent] = useState("");
  const [model, setModel] = useState("");

  // Batch mode state
  const [batchMode, setBatchMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedSkillVersionIds, setSelectedSkillVersionIds] = useState<(string | null)[]>([]);

  // Available models for selected agent
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const { data: skills } = useQuery({
    queryKey: ["skills"],
    queryFn: fetchSkills,
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
  });

  // Fetch models when agent changes
  useEffect(() => {
    if (agent) {
      fetchAgentModels(agent)
        .then((models) => {
          setAvailableModels(models);
          if (models.length > 0 && !models.includes(model)) {
            setModel(models[0]);
          }
        })
        .catch(() => {
          setAvailableModels([]);
        });
    } else {
      setAvailableModels([]);
    }
  }, [agent]);

  // Set default agent when agents load
  useEffect(() => {
    if (agents && agents.length > 0 && !agent) {
      setAgent(agents[0].name);
    }
  }, [agents, agent]);

  const singleMutation = useMutation({
    mutationFn: createRun,
    onSuccess: (run) => {
      router.push(`/runs/${run.id}`);
    },
  });

  const batchMutation = useMutation({
    mutationFn: createBatchRun,
    onSuccess: (response) => {
      router.push(`/runs?batch=${response.batch_id}`);
    },
  });

  function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    singleMutation.mutate({
      task_id: taskId,
      skill_id: skillId,
      skill_version: skillVersion ?? 1,
      agent,
      model,
    });
  }

  function handleBatchSubmit(e: React.FormEvent) {
    e.preventDefault();
    batchMutation.mutate({
      task_ids: selectedTaskIds,
      skill_version_ids: selectedSkillVersionIds,
      agents: [agent],
      models: [model],
    });
  }

  function toggleTaskSelection(id: string) {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function toggleSkillVersionSelection(id: string | null) {
    setSelectedSkillVersionIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  // Build a flat list of skill versions for batch multi-select
  const skillVersionOptions: { id: string | null; label: string }[] = [
    { id: null, label: "No Skill (baseline)" },
  ];
  if (skills) {
    for (const skill of skills) {
      for (let v = 1; v <= skill.latest_version; v++) {
        skillVersionOptions.push({
          id: `${skill.id}:v${v}`,
          label: `${skill.name} v${v}`,
        });
      }
    }
  }

  const isError = batchMode ? batchMutation.isError : singleMutation.isError;
  const errorMessage = batchMode
    ? batchMutation.error?.message
    : singleMutation.error?.message;
  const isPending = batchMode ? batchMutation.isPending : singleMutation.isPending;

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

      {/* Batch Mode Toggle */}
      <div className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 shadow-sm p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={batchMode}
              onChange={(e) => setBatchMode(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-300 rounded-full peer-checked:bg-blue-600 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-5 transition-transform" />
          </div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Batch Mode</span>
          </div>
        </label>
        <span className="text-xs text-slate-400">
          Run multiple tasks and skill versions at once
        </span>
      </div>

      <form
        onSubmit={batchMode ? handleBatchSubmit : handleSingleSubmit}
        className="space-y-6"
      >
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-5">
          {batchMode ? (
            <>
              {/* Batch Mode: Multi-select tasks */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tasks <span className="text-red-500">*</span>
                </label>
                <div className="border border-slate-300 rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                  {tasks?.map((task) => (
                    <label
                      key={task.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.includes(task.id)}
                        onChange={() => toggleTaskSelection(task.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">
                        {task.name}{" "}
                        <span className="text-slate-400">({task.difficulty})</span>
                      </span>
                    </label>
                  ))}
                  {(!tasks || tasks.length === 0) && (
                    <p className="text-sm text-slate-400 p-2">No tasks available.</p>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {selectedTaskIds.length} task(s) selected
                </p>
              </div>

              {/* Batch Mode: Multi-select skill versions */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Skill Versions <span className="text-red-500">*</span>
                </label>
                <div className="border border-slate-300 rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
                  {skillVersionOptions.map((opt) => (
                    <label
                      key={opt.id ?? "baseline"}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSkillVersionIds.includes(opt.id)}
                        onChange={() => toggleSkillVersionSelection(opt.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {selectedSkillVersionIds.length} version(s) selected
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Single Mode: Task select */}
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

              {/* Single Mode: Skill select */}
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

              {/* Single Mode: Skill Version */}
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
            </>
          )}

          {/* Agent and Model selects (shared) */}
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
                <option value="">Select agent...</option>
                {agents?.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.display_name}
                  </option>
                ))}
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
                <option value="">Select model...</option>
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {agent && availableModels.length === 0 && (
                <p className="mt-1 text-xs text-slate-400">
                  No models available for this agent.
                </p>
              )}
            </div>
          </div>
        </div>

        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">Error: {errorMessage}</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={
              isPending ||
              !agent ||
              !model ||
              (batchMode
                ? selectedTaskIds.length === 0 || selectedSkillVersionIds.length === 0
                : !taskId || !skillId)
            }
            className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending
              ? batchMode
                ? "Launching Batch..."
                : "Creating..."
              : batchMode
              ? "Launch Batch"
              : "Create Run"}
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
