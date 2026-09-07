/** Port 465 = implicit TLS; 587/25/2525 = plain connect then STARTTLS. */
export function normalizeSmtpSecure(port: number, secure: boolean): boolean {
  if (port === 465) return true;
  if (port === 587 || port === 25 || port === 2525) return false;
  return secure;
}

export function smtpTlsMismatchMessage(port: number, secure: boolean): string | null {
  if (port === 587 && secure) {
    return 'Port 587 requires STARTTLS (turn off "Use SSL"). Use port 465 if your host requires SSL.';
  }
  if (port === 465 && !secure) {
    return 'Port 465 requires SSL/TLS (turn on "Use SSL").';
  }
  return null;
}

export function isSmtpTlsVersionError(message: string): boolean {
  return /wrong version number|tls_validate_record_header|ssl3_get_record/i.test(
    message,
  );
}
