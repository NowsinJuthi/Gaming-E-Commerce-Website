import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type DeployManifest = {
  deployedAt?: string;
  root?: string;
  buildId?: string;
  packageName?: string;
  packageVersion?: string;
  node?: string;
};

function readBuildId(): string {
  const path = join(process.cwd(), ".next", "BUILD_ID");
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8").trim();
}

function readManifest(): DeployManifest {
  const path = join(process.cwd(), "..", "..", "deploy-manifest.json");
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as DeployManifest;
  } catch {
    return {};
  }
}

/** Public deploy fingerprint — use after upload to confirm live build matches server files. */
export async function GET() {
  const manifest = readManifest();
  const buildId = readBuildId();

  return NextResponse.json(
    {
      ok: true,
      buildId,
      deployedAt: manifest.deployedAt ?? null,
      packageName: manifest.packageName ?? null,
      packageVersion: manifest.packageVersion ?? null,
      webCwd: process.cwd(),
      deployRoot: manifest.root ?? null,
      node: manifest.node ?? process.version,
      matchesManifest: manifest.buildId ? manifest.buildId === buildId : null,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    },
  );
}
