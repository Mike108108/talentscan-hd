/** Escape text for safe HTML interpolation */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render formula with only <em> and <strong> tags (whitelist).
 * All other content is escaped.
 */
export function formulaToSafeHtml(raw: string): string {
  const placeholders: string[] = [];
  let work = raw;

  work = work.replace(/<\/?em>/gi, (m) => {
    const id = placeholders.length;
    placeholders.push(m.toLowerCase().startsWith("</") ? "</em>" : "<em>");
    return `\x00${id}\x00`;
  });
  work = work.replace(/<\/?strong>/gi, (m) => {
    const id = placeholders.length;
    placeholders.push(m.toLowerCase().startsWith("</") ? "</strong>" : "<strong>");
    return `\x00${id}\x00`;
  });

  let escaped = escapeHtml(work);
  placeholders.forEach((tag, id) => {
    escaped = escaped.replace(`\x00${id}\x00`, tag);
  });
  return escaped;
}
