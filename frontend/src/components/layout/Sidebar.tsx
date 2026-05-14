"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Play,
  BarChart3,
  GitCompare,
  Zap,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Skills", href: "/skills", icon: BookOpen },
  { label: "Tasks", href: "/tasks", icon: ClipboardList },
  { label: "Runs", href: "/runs", icon: Play },
  { label: "Compare", href: "/compare", icon: GitCompare },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900 text-slate-200 flex flex-col z-50">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-800">
        <Zap className="w-6 h-6 text-blue-400" />
        <span className="text-lg font-bold tracking-tight">SkillForge</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 border-t border-slate-800 text-xs text-slate-500">
        SkillForge v0.1.0
      </div>
    </aside>
  );
}
