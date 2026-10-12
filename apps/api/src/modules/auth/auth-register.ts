import type { RegisterResult } from './auth.types';

/**
 * Same success shape as a new registration so callers cannot tell whether
 * the email already had an account.
 */
export function enumerationSafeRegisterResult(email: string): RegisterResult {
  return {
    requiresVerification: true,
    email: email.trim().toLowerCase(),
  };
}
