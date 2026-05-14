interface StatusIndicatorProps {
  status: "pending" | "building" | "running" | "completed" | "failed";
  label?: string;
}

export function StatusIndicator({ status, label }: StatusIndicatorProps) {
  let dotClass = "";
  let textClass = "";
  let displayLabel = label ?? status;

  switch (status) {
    case "pending":
      dotClass = "bg-slate-400";
      textClass = "text-slate-600";
      break;
    case "building":
      dotClass = "bg-blue-500 animate-pulse";
      textClass = "text-blue-700";
      break;
    case "running":
      dotClass = "bg-blue-500 animate-pulse";
      textClass = "text-blue-700";
      break;
    case "completed":
      dotClass = "bg-green-500";
      textClass = "text-green-700";
      break;
    case "failed":
      dotClass = "bg-red-500";
      textClass = "text-red-700";
      break;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-2.5 w-2.5">
        {(status === "running" || status === "building") && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotClass}`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotClass}`}
        />
      </span>
      {label !== undefined && (
        <span className={`text-xs font-medium capitalize ${textClass}`}>
          {displayLabel}
        </span>
      )}
    </span>
  );
}
