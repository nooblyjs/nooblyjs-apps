// The public account screens: sign up (the marketing page, product.md §6.1), forgot and reset password, verify email
// and the invitation link. Signing in is nooblyjs-core's login page (login.js). Each returns { title, content, mount? }; mount binds the forms.
import { html } from '../html.js';
import { api } from '../api.js';
import { bindForm } from '../forms.js';
import { emptyState } from '../components/index.js';
import { LOGIN_PAGE, loginUrl } from '../login.js';

const homeOf = (me) => (me.operator && !me.workspaces.length ? '/admin' : `/w/${me.workspaces[0]?.id ?? ''}`);

/** One labelled field with its error slot (forms.js fills it from a 422). */
function field({ name, label, type = 'text', autocomplete, hint, value = '', required = true, readonly = false }) {
  const describedBy = [hint ? `${name}-hint` : '', `${name}-error`].filter(Boolean).join(' ');
  return html`<div class="mb-3">
    <label class="form-label" for="f-${name}">${label}</label>
    <input class="form-control" id="f-${name}" name="${name}" type="${type}" value="${value}" aria-describedby="${describedBy}"${autocomplete ? html` autocomplete="${autocomplete}"` : ''}${required ? html` required` : ''}${readonly ? html` readonly` : ''}>
    ${hint ? html`<div class="form-text" id="${name}-hint">${hint}</div>` : ''}
    <div class="invalid-feedback" id="${name}-error" data-for="${name}"></div>
  </div>`;
}

const alertSlot = () => html`<div class="alert alert-danger" role="alert" tabindex="-1" data-form-alert hidden></div>`;

function githubButton({ label, href, enabled }) {
  if (!enabled) return '';
  return html`<a class="btn nj-btn-github w-100" href="${href}" data-reload data-github><i class="bi bi-github" aria-hidden="true"></i>${label}</a>`;
}

function card(title, lead, body) {
  return html`<section class="nj-auth-card" aria-labelledby="auth-title">
    <h2 class="nj-auth-title" id="auth-title">${title}</h2>
    ${lead ? html`<p class="nj-meta mb-4">${lead}</p>` : ''}
    ${body}
  </section>`;
}

const GITHUB_ERRORS = {
  github: 'GitHub sign-in did not finish. Try again.',
  'github-email': 'Your GitHub account has no verified email address. Verify one on GitHub, or sign up with email.',
};

// ---- sign up (/) ---------------------------------------------------------------------

export function signUpPage({ me, config, url, serviceTypes }) {
  const invite = url.searchParams.get('invite') ?? '';
  const githubError = GITHUB_ERRORS[url.searchParams.get('error')];
  const ghHref = (marketing) => `/auth/github?${new URLSearchParams({ ...(invite ? { invite } : {}), ...(marketing ? { marketing: '1' } : {}) })}`;
  const account = me
    ? card('You are signed in', `As ${me.name} (${me.email}).`, html`<a class="btn btn-primary w-100" href="${homeOf(me)}">Open dashboard</a>`)
    : card('Create your account', 'Free to start. Add a card when you need more than the free tier.', html`
      <p class="nj-invite-note" data-invite-note hidden></p>
      ${githubError ? html`<div class="alert alert-warning" role="alert">${githubError}</div>` : ''}
      ${githubButton({ label: 'Continue with GitHub', href: ghHref(false), enabled: config.github })}
      ${config.github ? html`<div class="nj-divider"><span>or sign up with email</span></div>` : ''}
      <form novalidate data-form="signup">
        ${alertSlot()}
        ${field({ name: 'name', label: 'Your name', autocomplete: 'name' })}
        ${field({ name: 'team', label: 'Team or company', autocomplete: 'organization' })}
        ${field({ name: 'email', label: 'Work email', type: 'email', autocomplete: 'email' })}
        ${field({ name: 'password', label: 'Password', type: 'password', autocomplete: 'new-password', hint: config.passwordHint })}
        <div class="form-check mb-4">
          <input class="form-check-input" type="checkbox" id="f-marketing" name="marketing">
          <label class="form-check-label" for="f-marketing">Send me product news and tips by email. You can unsubscribe at any time.</label>
        </div>
        ${invite ? html`<input type="hidden" name="invite" value="${invite}">` : ''}
        <button type="submit" class="btn btn-primary w-100">Create account</button>
      </form>
      <p class="nj-meta text-center mt-3 mb-0">Already have an account? <a href="${invite ? loginUrl(`/invite?token=${invite}`) : LOGIN_PAGE}">Sign in</a> · <a href="/forgot-password">Forgot your password?</a></p>`);

  const features = [
    ['github', 'Connect GitHub', 'Pick a repo and a branch. Every push deploys.'],
    ['speedometer2', 'See resources', 'CPU, memory and bandwidth for each service.'],
    ['terminal', 'Read live logs', 'Stream, search and filter by level.'],
  ];
  return {
    title: 'NooblyJS Cloud: from a GitHub repo to a live service',
    content: html`<div class="nj-signup">
      <section class="nj-signup-hero">
        <p class="nj-eyebrow">Runs on NooblyJS Engineering</p>
        <h1 class="nj-hero-title">From a GitHub repo to a live service, without the ops work.</h1>
        <p class="nj-lead">Connect your repository, pick what you are running and NooblyJS Cloud builds it, deploys it on every push, and shows you exactly what each service is using.</p>
        <p class="nj-eyebrow mt-5" id="product">What you can launch</p>
        <ul class="nj-chips">${serviceTypes.map((t) => html`<li class="chip">${t.name}</li>`)}</ul>
        <ul class="nj-features">${features.map(([icon, name, text]) => html`<li class="nj-feature">
          <span class="nj-option-icon" aria-hidden="true"><i class="bi bi-${icon}"></i></span>
          <div><h2 class="nj-feature-name">${name}</h2><p class="nj-feature-text">${text}</p></div>
        </li>`)}</ul>
      </section>
      ${account}
    </div>`,
    async mount(root) {
      const form = root.querySelector('[data-form="signup"]');
      bindForm(form, { path: '/api/v1/auth/signup', busy: 'Creating your account…' });
      const consent = root.querySelector('#f-marketing');
      const gh = root.querySelector('[data-github]');
      consent?.addEventListener('change', () => { if (gh) gh.href = ghHref(consent.checked); });
      if (invite && form) {
        try {
          const inv = await api(`/api/v1/invitations/${encodeURIComponent(invite)}`);
          const note = root.querySelector('[data-invite-note]');
          note.textContent = `${inv.inviter.name} invited you to ${inv.workspace.name}. Create your account to join.`;
          note.hidden = false;
          if (inv.email) form.elements.namedItem('email').value = inv.email;
        } catch { /* expired: sign up as usual */ }
      }
    },
  };
}

// ---- forgot and reset password --------------------------------------------------------

export function forgotPasswordPage() {
  return {
    title: 'Forgot password · NooblyJS Cloud',
    content: html`<div class="nj-auth">${card('Reset your password', 'Enter the email you signed up with. We will send you a link to choose a new password.', html`
      <form novalidate data-form="forgot">
        ${alertSlot()}
        ${field({ name: 'email', label: 'Email', type: 'email', autocomplete: 'email' })}
        <button type="submit" class="btn btn-primary w-100">Send reset link</button>
      </form>
      <div data-sent hidden></div>
      <p class="nj-meta text-center mt-3 mb-0"><a href="${LOGIN_PAGE}">Back to sign in</a></p>`)}</div>`,
    mount(root) {
      bindForm(root.querySelector('[data-form="forgot"]'), {
        path: '/api/v1/auth/forgot-password',
        busy: 'Sending…',
        done: (result, form) => {
          const email = form.elements.namedItem('email').value;
          const sent = root.querySelector('[data-sent]');
          sent.innerHTML = String(html`<div class="alert alert-success" role="status">Check your email. If an account uses <strong>${email}</strong>, we sent it a link that works for 1 hour.</div>`);
          sent.hidden = false;
          form.hidden = true;
        },
      });
    },
  };
}

export function resetPasswordPage({ url, config }) {
  const token = url.searchParams.get('token') ?? '';
  return {
    title: 'Choose a new password · NooblyJS Cloud',
    content: html`<div class="nj-auth">${card('Choose a new password', 'Every other device signed in to your account will be signed out.', html`
      <form novalidate data-form="reset">
        ${alertSlot()}
        ${field({ name: 'password', label: 'New password', type: 'password', autocomplete: 'new-password', hint: config.passwordHint })}
        <input type="hidden" name="token" value="${token}">
        <button type="submit" class="btn btn-primary w-100">Save password and sign in</button>
      </form>
      <p class="nj-meta text-center mt-3 mb-0"><a href="/forgot-password">Ask for a new link</a></p>`)}</div>`,
    mount(root) {
      bindForm(root.querySelector('[data-form="reset"]'), { path: '/api/v1/auth/reset-password', busy: 'Saving…' });
    },
  };
}

// ---- verify email ---------------------------------------------------------------------

export function verifyEmailPage({ url }) {
  const token = url.searchParams.get('token') ?? '';
  return {
    title: 'Verify email · NooblyJS Cloud',
    content: html`<div class="nj-auth" data-verify>${card('Verifying your email…', '', '')}</div>`,
    async mount(root) {
      const box = root.querySelector('[data-verify]');
      try {
        const result = await api('/api/v1/auth/verify-email', { method: 'POST', body: { token } });
        box.innerHTML = String(card('Your email is verified', 'Thank you. You can now use everything in your workspace.', html`<a class="btn btn-primary w-100" href="${result.redirect}">Continue</a>`));
      } catch (err) {
        box.innerHTML = String(card('This link did not work', err.message, html`<a class="btn btn-secondary w-100" href="${LOGIN_PAGE}">Sign in</a>`));
      }
    },
  };
}

// ---- invitation link -------------------------------------------------------------------

export function invitePage({ url, me, config }) {
  const token = url.searchParams.get('token') ?? '';
  const here = `/invite?token=${encodeURIComponent(token)}`;
  return {
    title: 'Invitation · NooblyJS Cloud',
    content: html`<div class="nj-auth" data-invite>${card('Opening your invitation…', '', '')}</div>`,
    async mount(root) {
      const box = root.querySelector('[data-invite]');
      let inv;
      try {
        inv = await api(`/api/v1/invitations/${encodeURIComponent(token)}`);
      } catch (err) {
        box.innerHTML = String(html`<section class="nj-hero">${emptyState({ icon: 'envelope-x', title: 'This invitation cannot be used', text: err.message, action: html`<a class="btn btn-secondary" href="/">Go home</a>` })}</section>`);
        return;
      }
      const title = `${inv.inviter.name} invited you to ${inv.workspace.name}`;
      let body;
      if (inv.alreadyMember) body = html`<p>You are already a member.</p><a class="btn btn-primary w-100" href="/w/${inv.workspaceId}">Open ${inv.workspace.name}</a>`;
      else if (inv.canAccept) body = html`<form data-form="accept">${alertSlot()}<button type="submit" class="btn btn-primary w-100">Join ${inv.workspace.name}</button></form>`;
      else if (me) body = html`<p>You are signed in as <strong>${inv.signedInAs}</strong>, but this invitation is for another email address. Sign out, then sign in with the invited address.</p><button type="button" class="btn btn-secondary w-100" data-action="signout">Sign out</button>`;
      else {
        body = html`<p class="nj-meta">The invitation is for <strong>${inv.email}</strong>.</p>
          ${githubButton({ label: 'Continue with GitHub', href: `/auth/github?invite=${encodeURIComponent(token)}`, enabled: config.github })}
          <a class="btn btn-primary w-100 mt-2" href="/?invite=${encodeURIComponent(token)}">Create an account</a>
          <a class="btn btn-secondary w-100 mt-2" href="${loginUrl(here)}">Sign in</a>`;
      }
      box.innerHTML = String(card(title, `You will join as a ${inv.role}.`, body));
      bindForm(box.querySelector('[data-form="accept"]'), { path: `/api/v1/invitations/${encodeURIComponent(token)}/accept`, busy: 'Joining…' });
    },
  };
}
