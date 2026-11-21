// Pages are rendered for signed-out visitors, so a signed-in member used to see the public page (login buttons, public
// hero) for a moment until the session was read. A cookie check runs before first paint (AUTH_HINT_SCRIPT) and sets
// <html data-auth="1">; CSS then hides the signed-out parts until we know. If the session turns out to be gone we call
// clearAuthHint() and they come back.
export const AUTH_HINT_SCRIPT = `try{if(/(?:^|; )sb-[^=;]*-auth-token/.test(document.cookie))document.documentElement.dataset.auth="1"}catch(e){}`;

export function clearAuthHint(): void {
  try {
    delete document.documentElement.dataset.auth;
  } catch {
    /* not in a browser */
  }
}
