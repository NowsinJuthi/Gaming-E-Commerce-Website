import { ApiError, toApiError } from "./api";

export const AUTH_NO_ACCOUNT_MESSAGE =
  "আপনার ইমেইল দিয়ে কোনো অ্যাকাউন্ট খোলা নেই। অনুগ্রহ করে আপনার ইমেইল দিয়ে নতুন করে একাউন্ট খুলুন অথবা ভালো করে যাচাই করুন আপনি ইমেইল ভুল দিয়েছেন কিনা।";

export const AUTH_WRONG_PASSWORD_MESSAGE =
  "আপনি পাসওয়ার্ড ভুল দিয়েছেন। অনুগ্রহ করে সঠিক পাসওয়ার্ড দিয়ে আবার চেষ্টা করুন অথবা ইমেইল কোড দিয়ে লগইন করুন।";

function authErrorMessage(err: unknown): string {
  const apiErr = toApiError(err);
  if (apiErr?.message) return apiErr.message;
  if (err instanceof Error) return err.message;
  return "";
}

function authErrorStatus(err: unknown): number | undefined {
  return toApiError(err)?.status;
}

export function isAuthNoAccountError(err: unknown): err is ApiError {
  const apiErr = toApiError(err);
  if (apiErr?.accountExists === false) return true;

  const message = authErrorMessage(err);
  const status = authErrorStatus(err);
  return (
    status === 404 || message.includes("অ্যাকাউন্ট খোলা নেই")
  );
}

export function isAuthWrongPasswordError(err: unknown): err is ApiError {
  const apiErr = toApiError(err);
  if (apiErr?.invalidPassword === true) return true;

  const message = authErrorMessage(err);
  const status = authErrorStatus(err);
  return (
    status === 401 &&
    (message.includes("পাসওয়ার্ড ভুল") ||
      message.toLowerCase().includes("password"))
  );
}
