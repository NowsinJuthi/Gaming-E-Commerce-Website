export function accessTokenVersionMatches(
  tokenVer: number | undefined,
  userVer: number | undefined,
): boolean {
  return (tokenVer ?? 0) === (userVer ?? 0);
}
