"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTasks, importTasks } from "@/lib/api";
import { ClipboardList, Download, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-5 bg-slate-200 rounded w-32" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-slate-100 rounded" />
        ))}
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

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [showImport, setShowImport] = useState(false);
  const [importPath, setImportPath] = useState(
    "/data/home/jimmyxyshan/skillsbench/tasks"
  );

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });

  const importMutation = useMutation({
    mutationFn: importTasks,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setShowImport(false);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="text-slate-500 mt-1">
            Browse and import evaluation tasks.
          </p>
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          Import from SkillsBench
        </button>
      </div>

      {showImport && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">
            Import Tasks
          </h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Source Path
            </label>
            <input
              type="text"
              value={importPath}
              onChange={(e) => setImportPath(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => importMutation.mutate(importPath)}
              disabled={!importPath.trim() || importMutation.isPending}
              className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importMutation.isPending ? "Importing..." : "Import"}
            </button>
            <button
              onClick={() => setShowImport(false)}
              className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
          {importMutation.isSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-700">
                Imported {importMutation.data.imported} tasks
                {importMutation.data.skipped > 0 &&
                  `, skipped ${importMutation.data.skipped}`}
              </p>
              {importMutation.data.errors.length > 0 && (
                <ul className="mt-2 text-xs text-red-600 list-disc list-inside">
                  {importMutation.data.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {importMutation.isError && (
            <p className="text-sm text-red-600">
              Error: {importMutation.error.message}
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <LoadingSkeleton />
      ) : !tasks || tasks.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-12 text-center">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">
            No tasks yet
          </h3>
          <p className="text-slate-500 text-sm mb-4">
            Import tasks from SkillsBench to get started.
          </p>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Import Tasks
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-500">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">
                    Category
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">
                    Difficulty
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">
                    Tags
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="font-medium text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {task.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {task.category || "-"}
                    </td>
                    <td className="py-3 px-4">
                      <DifficultyBadge difficulty={task.difficulty} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {task.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                        {task.tags.length > 3 && (
                          <span className="text-xs text-slate-400">
                            +{task.tags.length - 3}
                          </span>
                        )}
                      </div>
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
