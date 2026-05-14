"use client";

import { useMemo } from "react";

interface SkillDiffViewerProps {
  diff: string;
  additions?: number;
  deletions?: number;
}

export function SkillDiffViewer({
  diff,
  additions,
  deletions,
}: SkillDiffViewerProps) {
  const lines = useMemo(() => diff.split("\n"), [diff]);

  const computedStats = useMemo(() => {
    if (additions !== undefined && deletions !== undefined) {
      return { additions, deletions };
    }
    let adds = 0;
    let dels = 0;
    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) adds++;
      else if (line.startsWith("-") && !line.startsWith("---")) dels++;
    }
    return { additions: adds, deletions: dels };
  }, [lines, additions, deletions]);

  function getLineStyle(line: string): string {
    if (line.startsWith("@@")) {
      return "bg-blue-50 text-blue-800";
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      return "bg-green-50 text-green-800";
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      return "bg-red-50 text-red-800";
    }
    if (line.startsWith("+++") || line.startsWith("---")) {
      return "bg-slate-50 text-slate-600 font-semibold";
    }
    return "text-slate-700";
  }

  if (!diff.trim()) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 text-center">
        <p className="text-slate-500 text-sm">No differences found.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-200 bg-slate-50">
        <span className="text-sm font-medium text-green-700">
          +{computedStats.additions} addition
          {computedStats.additions !== 1 ? "s" : ""}
        </span>
        <span className="text-sm font-medium text-red-700">
          -{computedStats.deletions} deletion
          {computedStats.deletions !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="overflow-x-auto">
        <pre className="font-mono text-xs leading-relaxed">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className={`px-4 py-0.5 ${getLineStyle(line)}`}
            >
              {line || " "}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
