"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSkill, createSkillVersion } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Clock, FileText, Tag } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-slate-200 rounded w-48" />
        <div className="h-4 bg-slate-100 rounded w-96" />
        <div className="h-64 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

export default function SkillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [activeTab, setActiveTab] = useState<"overview" | "versions">(
    "overview"
  );
  const [showCreateVersion, setShowCreateVersion] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [changeNote, setChangeNote] = useState("");

  const { data: skill, isLoading } = useQuery({
    queryKey: ["skill", id],
    queryFn: () => fetchSkill(id),
  });

  const createVersionMutation = useMutation({
    mutationFn: (data: { content: string; change_note: string }) =>
      createSkillVersion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill", id] });
      setShowCreateVersion(false);
      setNewContent("");
      setChangeNote("");
    },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!skill) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Skill not found.</p>
        <Link href="/skills" className="text-blue-600 hover:underline mt-2 inline-block">
          Back to Skills
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/skills"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">{skill.name}</h1>
        <p className="text-slate-500 mt-1">{skill.description}</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "overview"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("versions")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "versions"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Versions
        </button>
      </div>

      {activeTab === "overview" && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Version Count
              </p>
              <p className="text-lg font-semibold text-slate-900">
                {skill.version_count}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Category
              </p>
              <p className="text-lg font-semibold text-slate-900">
                {skill.category || "Uncategorized"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Latest Version
              </p>
              <p className="text-lg font-semibold text-slate-900">
                v{skill.latest_version}
              </p>
            </div>
          </div>
          {skill.tags && skill.tags.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                Tags
              </p>
              <div className="flex flex-wrap gap-2">
                {skill.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-xs font-medium"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "versions" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateVersion(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Create New Version
            </button>
          </div>

          {showCreateVersion && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
              <h3 className="text-base font-semibold text-slate-900">
                Create New Version
              </h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Content
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={10}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter skill content..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Change Note
                </label>
                <input
                  type="text"
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe what changed..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    createVersionMutation.mutate({
                      content: newContent,
                      change_note: changeNote,
                    })
                  }
                  disabled={
                    !newContent.trim() || createVersionMutation.isPending
                  }
                  className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createVersionMutation.isPending
                    ? "Creating..."
                    : "Create Version"}
                </button>
                <button
                  onClick={() => setShowCreateVersion(false)}
                  className="border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
              {createVersionMutation.isError && (
                <p className="text-sm text-red-600">
                  Error: {createVersionMutation.error.message}
                </p>
              )}
            </div>
          )}

          {skill.versions && skill.versions.length > 0 ? (
            <div className="space-y-3">
              {skill.versions
                .slice()
                .sort((a, b) => b.version - a.version)
                .map((version) => (
                  <div
                    key={version.id}
                    className="bg-white rounded-lg border border-slate-200 shadow-sm p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-xs font-semibold">
                          v{version.version}
                        </span>
                        <span className="text-sm text-slate-700">
                          {version.change_note || "No change note"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {version.word_count} words
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(version.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8 text-center">
              <p className="text-slate-500 text-sm">No versions yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
