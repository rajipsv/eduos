// HTML escaping for values inserted into innerHTML templates. Shared by browser code and tests.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

/**
 * Escapes a value for use in HTML text or a quoted attribute.
 * null/undefined become an empty string; numbers and booleans are kept as text.
 * @param {unknown} value
 * @returns {string}
 */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`]/g, (ch) => ESCAPES[ch]);
}

/**
 * Escaped URL for href/src attributes. Only http(s), mailto, tel, relative and #hash links are allowed;
 * anything else (e.g. javascript:) becomes "#".
 * @param {unknown} url
 * @returns {string}
 */
export function safeUrl(url) {
  const s = String(url ?? '').trim();
  if (!s) return '';
  if (/^(https?:|mailto:|tel:)/i.test(s) || /^[/#?.]/.test(s) || !/^[a-z][a-z0-9+.-]*:/i.test(s)) return esc(s);
  return '#';
}
