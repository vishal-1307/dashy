export const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
export const turnstileConfigured = Boolean(SITE_KEY);

/**
 * Returns the captcha header required by Better Auth's captcha plugin.
 * Empty when no token, so calls still work in environments without Turnstile configured.
 */
export function captchaHeaders(token: string): Record<string, string> {
  return token ? { "x-captcha-response": token } : {};
}
