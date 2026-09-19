// Safe notification body renderer.
// Legacy notification docs store HTML strings (e.g. `<b style="...">...`).
// Rendering those with dangerouslySetInnerHTML is a stored-XSS vector.
// This component strips all markup and renders plain text — React escapes
// text nodes, so no markup or script can execute. Legacy docs stay readable.
function stripNotificationMarkup(input) {
  return String(input ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

function NotificationText({ message, className }) {
  return <p className={className}>{stripNotificationMarkup(message)}</p>;
}

export default NotificationText;
