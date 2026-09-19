// Toast dispatcher. The <Toasts/> component lives in ui/Toast.jsx so the
// React fast-refresh rule (components only per file) stays satisfied.
export function toast(message, tone = "success") {
  window.dispatchEvent(
    new CustomEvent("tbi-toast", { detail: { message, tone, id: `${Date.now()}-${Math.random()}` } })
  );
}
