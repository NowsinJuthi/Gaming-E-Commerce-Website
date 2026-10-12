import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function readBuildId(): string {
  const path = join(process.cwd(), ".next", "BUILD_ID");
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8").trim();
}

/** Minimal public fingerprint so tabs can reload after a new deploy. */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      buildId: readBuildId(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    },
  );
}
