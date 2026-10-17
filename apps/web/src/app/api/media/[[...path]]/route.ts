import { NextRequest } from "next/server";
import { proxyToNest } from "@/lib/internal-api-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path?: string[] }> };

async function forward(req: NextRequest, context: RouteContext, method: string) {
  const { path = [] } = await context.params;
  const suffix = path.length ? `/${path.join("/")}` : "";
  return proxyToNest(req, `/media${suffix}`, method);
}

export async function GET(req: NextRequest, context: RouteContext) {
  return forward(req, context, "GET");
}

export async function POST(req: NextRequest, context: RouteContext) {
  return forward(req, context, "POST");
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  return forward(req, context, "PATCH");
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  return forward(req, context, "DELETE");
}
