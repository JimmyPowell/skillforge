"use client";

import { useState } from "react";
import type { TrajectoryEvent } from "@/lib/api";
import {
  MessageSquare,
  Terminal,
  FileText,
  Pencil,
  Bot,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useEffect, useRef } from "react";

function getTypeIcon(event: TrajectoryEvent) {
  if (event.type === "user_message") {
    return <MessageSquare className="w-4 h-4 text-blue-500" />;
  }
  if (event.type === "agent_message") {
    return <Bot className="w-4 h-4 text-green-500" />;
  }
  // tool_call
  if (event.title === "Skill" || event.kind === "skill") {
    return <Sparkles className="w-4 h-4 text-orange-500" />;
  }
  if (event.kind === "execute" || event.title === "Terminal") {
    return <Terminal className="w-4 h-4 text-orange-500" />;
  }
  if (event.kind === "read" || event.title === "Read") {
    return <FileText className="w-4 h-4 text-orange-500" />;
  }
  if (event.kind === "write" || event.title === "Write") {
    return <Pencil className="w-4 h-4 text-orange-500" />;
  }
  return <Terminal className="w-4 h-4 text-orange-500" />;
}

function renderContent(content: string) {
  // Split content by code blocks and render differently
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const code = part.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
      return (
        <pre
          key={i}
          className="bg-slate-900 text-green-400 rounded-lg p-4 font-mono text-sm overflow-x-auto my-2"
        >
          {code}
        </pre>
      );
    }
    return (
      <span key={i} className="whitespace-pre-wrap break-words">
        {part}
      </span>
    );
  });
}

interface TrajectoryTimelineProps {
  events: TrajectoryEvent[];
  currentStep: number | null;
  onStepClick?: (step: number) => void;
}

export default function TrajectoryTimeline({
  events,
  currentStep,
  onStepClick,
}: TrajectoryTimelineProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const stepRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  const toggleStep = (step: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) {
        next.delete(step);
      } else {
        next.add(step);
      }
      return next;
    });
  };

  useEffect(() => {
    if (currentStep !== null) {
      const el = stepRefs.current.get(currentStep);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [currentStep]);

  if (events.length === 0) {
    return (
      <div className="rounded-lg bg-slate-50 border border-dashed border-slate-300 p-8 text-center">
        <p className="text-sm text-slate-400">No trajectory events available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {events.map((event) => {
        const isExpanded = expandedSteps.has(event.step);
        const isCurrent = currentStep === event.step;
        const isSkillRelated = event.is_skill_related;

        return (
          <div
            key={event.step}
            ref={(el) => {
              stepRefs.current.set(event.step, el);
            }}
            className={`
              rounded-lg border transition-all duration-200
              ${isCurrent ? "ring-2 ring-blue-400 border-blue-300" : "border-slate-200"}
              ${isSkillRelated ? "border-l-4 border-l-violet-500 bg-violet-50" : "bg-white"}
            `}
          >
            <button
              type="button"
              onClick={() => {
                toggleStep(event.step);
                onStepClick?.(event.step);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors rounded-lg"
            >
              <span className="flex-shrink-0 text-xs font-mono text-slate-400 w-8 text-right">
                {event.step}
              </span>
              <span className="flex-shrink-0">{getTypeIcon(event)}</span>
              <span className="flex-shrink-0 text-xs font-medium text-slate-500 w-16">
                {event.title || event.type.replace("_", " ")}
              </span>
              {isSkillRelated && (
                <span className="flex-shrink-0 inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                  SKILL
                </span>
              )}
              <span className="flex-1 text-sm text-slate-700 truncate">
                {event.content.slice(0, 120)}
                {event.content.length > 120 ? "..." : ""}
              </span>
              {event.duration_ms !== null && (
                <span className="flex-shrink-0 text-xs text-slate-400">
                  {event.duration_ms >= 1000
                    ? `${(event.duration_ms / 1000).toFixed(1)}s`
                    : `${event.duration_ms}ms`}
                </span>
              )}
              <span className="flex-shrink-0 text-slate-400">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 pl-[4.5rem] border-t border-slate-100">
                <div className="mt-3 text-sm text-slate-700">
                  {renderContent(event.content)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
