// The one sign-in screen is nooblyjs-core's authservice login page; it returns to `returnUrl` after signing in.
export const LOGIN_PAGE = '/services/authservice/views/login.html';

/** The login page, coming back to `next` (a same-site path) afterwards. */
export const loginUrl = (next) => (typeof next === 'string' && /^\/(?![/\\])/.test(next) ? `${LOGIN_PAGE}?returnUrl=${encodeURIComponent(next)}` : LOGIN_PAGE);
