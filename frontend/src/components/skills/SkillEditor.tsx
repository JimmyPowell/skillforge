"use client";

import Editor from "@monaco-editor/react";

interface SkillEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}

export function SkillEditor({ value, onChange, readOnly = false }: SkillEditorProps) {
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden" style={{ minHeight: "400px" }}>
      <Editor
        height="400px"
        defaultLanguage="markdown"
        theme="vs-dark"
        value={value}
        onChange={(val) => {
          if (onChange && val !== undefined) {
            onChange(val);
          }
        }}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          wordWrap: "on",
          scrollBeyondLastLine: false,
          padding: { top: 12, bottom: 12 },
        }}
      />
    </div>
  );
}
