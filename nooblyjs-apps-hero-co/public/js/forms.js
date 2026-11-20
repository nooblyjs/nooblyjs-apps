// Forms that post JSON to the API: field errors from a 422's details[] appear under their fields (aria-invalid,
// aria-describedby), any other error in the form's alert, and the busy button says what it is doing.
import { api, ApiError } from './api.js';

/** The form's named fields as an object (checkboxes as booleans). */
export function values(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    out[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  }
  return out;
}

function clear(form) {
  for (const el of form.querySelectorAll('[aria-invalid="true"]')) {
    el.removeAttribute('aria-invalid');
    el.classList.remove('is-invalid');
  }
  for (const el of form.querySelectorAll('.invalid-feedback[data-for]')) el.textContent = '';
  const alert = form.querySelector('[data-form-alert]');
  if (alert) {
    alert.textContent = '';
    alert.hidden = true;
  }
}

export function showErrors(form, err) {
  const details = err instanceof ApiError && Array.isArray(err.details) ? err.details : [];
  let firstField = null;
  for (const d of details) {
    const field = form.elements.namedItem(d.path);
    const feedback = form.querySelector(`.invalid-feedback[data-for="${CSS.escape(d.path)}"]`);
    if (field && feedback) {
      field.setAttribute('aria-invalid', 'true');
      field.classList.add('is-invalid');
      feedback.textContent = d.message;
      firstField ??= field;
    }
  }
  if (firstField) return firstField.focus();
  const alert = form.querySelector('[data-form-alert]');
  if (alert) {
    alert.textContent = err?.message ?? 'Something went wrong. Try again.';
    alert.hidden = false;
    alert.focus();
  }
}

/**
 * Posts a form to `path` on submit.
 * @param {HTMLFormElement} form
 * @param {{ path: string|((v: object) => string), method?: string, body?: (v: object) => object, busy?: string,
 *   done?: (result: any, form: HTMLFormElement) => void }} o   done defaults to following result.redirect
 */
export function bindForm(form, { path, method = 'POST', body = (v) => v, busy = 'Working…', done }) {
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clear(form);
    const button = form.querySelector('[type="submit"]');
    const label = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = busy;
    }
    try {
      const v = values(form);
      const result = await api(typeof path === 'function' ? path(v) : path, { method, body: body(v) });
      if (done) done(result, form);
      else if (result?.redirect) window.location.assign(result.redirect);
    } catch (err) {
      showErrors(form, err);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = label;
      }
    }
  });
}
