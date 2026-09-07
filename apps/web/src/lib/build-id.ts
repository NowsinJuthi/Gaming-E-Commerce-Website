import { existsSync, readFileSync } from "fs";
import { join } from "path";

/** Next.js production build id (changes every deploy). */
export function getAppBuildId(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BUILD_ID?.trim();
  if (fromEnv) return fromEnv;

  try {
    const path = join(process.cwd(), ".next", "BUILD_ID");
    if (!existsSync(path)) return "";
    return readFileSync(path, "utf8").trim();
  } catch {
    return "";
  }
}
