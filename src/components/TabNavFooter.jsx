import { useEffect } from "react";

const btn = (disabled, primary) => ({
  padding: "8px 22px",
  fontSize: 13,
  fontWeight: 700,
  borderRadius: 4,
  border: "1px solid #0f3c52",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.45 : 1,
  background: primary ? "#0f3c52" : "#fff",
  color: primary ? "#fff" : "#0f3c52",
});

export default function TabNavFooter({ tabs, activeTab, onChange }) {
  const idx = tabs.indexOf(activeTab);
  const isFirst = idx <= 0;
  const isLast = idx === tabs.length - 1;

  const goPrev = () => !isFirst && onChange(tabs[idx - 1]);
  const goNext = () => !isLast && onChange(tabs[idx + 1]);

  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey || e.ctrlKey || e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k === "n") { e.preventDefault(); goNext(); }
      if (k === "p") { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, tabs]);

  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 20,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 12px",
        marginTop: 12,
        background: "#eaf3f9",
        borderTop: "1px solid #c2d7e8",
      }}
    >
      <button type="button" disabled={isFirst} onClick={goPrev} style={btn(isFirst, false)}>
        ◀ Previous 
      </button>
      <span style={{ fontSize: 11, color: "#2A3D4F", fontWeight: 600 }}>
        Step {idx + 1} of {tabs.length}
      </span>
      <button type="button" disabled={isLast} onClick={goNext} style={btn(isLast, true)}>
        Next  ▶
      </button>
    </div>
  );
}