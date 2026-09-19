import { useEffect, useState } from "react";

// Toast feedback. Screens call toast("Saved") from lib/toast.js instead of
// alert(); <Toasts/> is mounted once in AppShell.
export function Toasts() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const onToast = (e) => {
      const item = e.detail;
      setItems((prev) => [...prev.slice(-3), item]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== item.id));
      }, 4000);
    };
    window.addEventListener("tbi-toast", onToast);
    return () => window.removeEventListener("tbi-toast", onToast);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 items-end" aria-live="polite">
      {items.map((t) => (
        <p
          key={t.id}
          role="status"
          className={`px-4 py-2.5 rounded shadow-lg text-sm font-medium text-white max-w-xs ${
            t.tone === "error" ? "bg-red-600" : "bg-slate-900"
          }`}
        >
          {t.message}
        </p>
      ))}
    </div>
  );
}
