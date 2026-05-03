import { useState } from "react";
import { Info } from "lucide-react";

interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1 align-middle">
      <button
        type="button"
        className="w-4 h-4 rounded-full flex items-center justify-center transition-colors focus:outline-none"
        style={{ color: "#9CA3AF" }}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        aria-label={text}
      >
        <Info size={13} />
      </button>
      {visible && (
        <span
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 rounded-xl text-xs font-normal leading-relaxed pointer-events-none"
          style={{
            background: "#1F2937",
            color: "#F9FAFB",
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            whiteSpace: "normal",
          }}
        >
          {text}
          <span
            className="absolute top-full left-1/2 -translate-x-1/2"
            style={{
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid #1F2937",
              display: "block",
              width: 0,
              height: 0,
            }}
          />
        </span>
      )}
    </span>
  );
}
