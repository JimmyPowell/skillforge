"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSkills } from "@/lib/api";
import Link from "next/link";
import { Plus, BookOpen } from "lucide-react";

function SkillCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
      <div className="animate-pulse space-y-3">
        <div className="h-5 bg-slate-200 rounded w-3/4" />
        <div className="h-4 bg-slate-100 rounded w-full" />
        <div className="h-4 bg-slate-100 rounded w-1/2" />
        <div className="flex gap-2 mt-4">
          <div className="h-5 bg-slate-100 rounded w-16" />
          <div className="h-5 bg-slate-100 rounded w-20" />
        </div>
      </div>
    </div>
  );
}

export default function SkillsPage() {
  const { data: skills, isLoading } = useQuery({
    queryKey: ["skills"],
    queryFn: fetchSkills,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Skills</h1>
          <p className="text-slate-500 mt-1">
            Manage your AI skill definitions and versions.
          </p>
        </div>
        <Link
          href="/skills/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Skill
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <SkillCardSkeleton key={i} />
          ))}
        </div>
      ) : !skills || skills.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">
            No skills yet
          </h3>
          <p className="text-slate-500 text-sm mb-4">
            Create your first skill to get started.
          </p>
          <Link
            href="/skills/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Skill
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill) => (
            <Link
              key={skill.id}
              href={`/skills/${skill.id}`}
              className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                {skill.name}
              </h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-3">
                {skill.description}
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 bg-slate-100 rounded-full px-2 py-0.5">
                  v{skill.latest_version}
                </span>
                <span>
                  {skill.version_count} version
                  {skill.version_count !== 1 ? "s" : ""}
                </span>
              </div>
              {skill.category && (
                <div className="mt-3">
                  <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-medium">
                    {skill.category}
                  </span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
