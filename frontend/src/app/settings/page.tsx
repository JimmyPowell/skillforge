"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Settings,
  Server,
  Activity,
  ExternalLink,
  CheckCircle,
  XCircle,
} from "lucide-react";

const API_BASE = "http://localhost:8000";

interface HealthResponse {
  status: string;
  docker_available: boolean;
  active_runs: number;
  queued_runs: number;
}

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

function StatusRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: "ok" | "error" | "neutral";
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="flex items-center gap-2">
        {status === "ok" && <CheckCircle className="w-4 h-4 text-green-500" />}
        {status === "error" && <XCircle className="w-4 h-4 text-red-500" />}
        <span
          className={`text-sm font-medium ${
            status === "ok"
              ? "text-green-700"
              : status === "error"
              ? "text-red-700"
              : "text-slate-900"
          }`}
        >
          {value}
        </span>
      </span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">
          System configuration and status.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-lg border border-slate-200 shadow-sm p-6"
          >
            <div className="animate-pulse space-y-4">
              <div className="h-5 bg-slate-200 rounded w-32" />
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-8 bg-slate-100 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const {
    data: health,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 10000,
    retry: 1,
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">
          System configuration and status.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Connection Status */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-semibold text-slate-900">
              API Backend
            </h2>
          </div>
          <div className="space-y-0">
            <StatusRow
              label="Backend URL"
              value={API_BASE}
              status="neutral"
            />
            <StatusRow
              label="Connection"
              value={error ? "Disconnected" : "Connected"}
              status={error ? "error" : "ok"}
            />
            <StatusRow
              label="Status"
              value={health?.status ?? "Unknown"}
              status={health?.status === "ok" ? "ok" : "error"}
            />
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-semibold text-slate-900">
              System Status
            </h2>
          </div>
          <div className="space-y-0">
            <StatusRow
              label="Docker"
              value={
                health?.docker_available ? "Available" : "Not Available"
              }
              status={health?.docker_available ? "ok" : "error"}
            />
            <StatusRow
              label="Active Runs"
              value={String(health?.active_runs ?? 0)}
              status="neutral"
            />
            <StatusRow
              label="Queued Runs"
              value={String(health?.queued_runs ?? 0)}
              status="neutral"
            />
          </div>
        </div>
      </div>

      {/* API Documentation Links */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-slate-700" />
          <h2 className="text-base font-semibold text-slate-900">
            API Documentation
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href={`${API_BASE}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">
                Swagger UI
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Interactive API documentation
              </p>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400" />
          </a>
          <a
            href={`${API_BASE}/redoc`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">ReDoc</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Alternative API reference
              </p>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-red-900 mb-1">
            Connection Error
          </h3>
          <p className="text-sm text-red-700">
            Unable to reach the API backend at {API_BASE}. Make sure the
            server is running.
          </p>
        </div>
      )}
    </div>
  );
}
