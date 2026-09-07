"use client";

import { usePathname } from "next/navigation";
import { blogWorkspaceBaseFromPath } from "@/lib/blog-workspace";

/** Base path for blog workspace links (/dashboard/blogs or /admin/blogs). */
export function useBlogWorkspaceBase(): string {
  const pathname = usePathname();
  return blogWorkspaceBaseFromPath(pathname);
}
