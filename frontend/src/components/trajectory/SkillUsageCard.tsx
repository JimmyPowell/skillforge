"use client";

import type { SkillUsageAnalysis } from "@/lib/api";
import { CheckCircle2, XCircle, Clock, BookOpen, Brain, Tag } from "lucide-react";

interface SkillUsageCardProps {
  analysis: SkillUsageAnalysis;
}

export default function SkillUsageCard({ analysis }: SkillUsageCardProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-6">
      <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">
        Skill Usage Analysis
      </h3>

      {/* Skill Read Status */}
      <div className="flex items-center gap-3">
        {analysis.skill_read ? (
          <CheckCircle2 className="w-6 h-6 text-green-500" />
        ) : (
          <XCircle className="w-6 h-6 text-red-400" />
        )}
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {analysis.skill_read ? "Skill was read" : "Skill was not read"}
          </p>
          {analysis.read_at_step !== null && (
            <p className="text-xs text-slate-500">
              Read at step {analysis.read_at_step}
            </p>
          )}
        </div>
      </div>

      {/* Read Method */}
      {analysis.read_method && (
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-slate-400 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Read Method
            </p>
            <p className="text-sm text-slate-900 mt-0.5">{analysis.read_method}</p>
          </div>
        </div>
      )}

      {/* Time to First Read */}
      {analysis.time_to_first_read_sec !== null && (
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Time to First Read
            </p>
            <p className="text-sm text-slate-900 mt-0.5">
              {analysis.time_to_first_read_sec.toFixed(1)}s
            </p>
          </div>
        </div>
      )}

      {/* Sections Accessed */}
      {analysis.sections_accessed.length > 0 && (
        <div className="flex items-start gap-3">
          <Tag className="w-5 h-5 text-slate-400 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              Sections Accessed
            </p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.sections_accessed.map((section) => (
                <span
                  key={section}
                  className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700"
                >
                  {section}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mentions in Reasoning */}
      {analysis.skill_mentions_in_reasoning.length > 0 && (
        <div className="flex items-start gap-3">
          <Brain className="w-5 h-5 text-slate-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              Mentions in Reasoning ({analysis.skill_mentions_in_reasoning.length})
            </p>
            <div className="space-y-2">
              {analysis.skill_mentions_in_reasoning.map((mention, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-slate-50 border border-slate-200 p-3"
                >
                  <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 mr-2">
                    Step {mention.step}
                  </span>
                  <span className="text-sm text-slate-700 italic">
                    &ldquo;{mention.quote}&rdquo;
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state for no mentions */}
      {!analysis.skill_read &&
        analysis.sections_accessed.length === 0 &&
        analysis.skill_mentions_in_reasoning.length === 0 && (
          <div className="rounded-lg bg-slate-50 border border-dashed border-slate-300 p-6 text-center">
            <p className="text-sm text-slate-400">
              No skill usage detected in this run.
            </p>
          </div>
        )}
    </div>
  );
}
