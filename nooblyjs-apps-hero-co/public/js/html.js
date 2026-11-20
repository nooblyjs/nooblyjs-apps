// Tagged-template HTML with escaping. Interpolated values are escaped unless they are the result of html`` or raw();
// arrays are joined. Pages build strings with it and set them with render(), never with inline styles or handlers.

const SAFE = Symbol('safe-html');

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Marks a string as already-safe HTML. */
export function raw(s) {
  return { [SAFE]: true, toString: () => String(s) };
}

function piece(value) {
  if (value === null || value === undefined || value === false) return '';
  if (Array.isArray(value)) return value.map(piece).join('');
  if (value?.[SAFE]) return String(value);
  return escapeHtml(value);
}

/** @returns {{ toString(): string }} safe HTML */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) out += piece(values[i]) + strings[i + 1];
  return raw(out);
}

/** Replaces an element's content. */
export function render(el, content) {
  el.innerHTML = String(content);
}
