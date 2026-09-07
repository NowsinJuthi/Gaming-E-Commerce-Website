import { ChartIcon } from "@/components/admin/icons";
import { AdminPageLayout } from "@/components/admin/AdminPageLayout";

export function AdminPlaceholder({
  section,
  title,
  description,
}: {
  section: string;
  title: string;
  description?: string;
}) {
  return (
    <AdminPageLayout section={section} title={title} description={description}>
      <div className="panel-3d-empty min-h-[320px]">
        <span className="panel-page-icon !h-16 !w-16 !animate-none" aria-hidden>
          <ChartIcon className="h-7 w-7" />
        </span>
        <p className="mt-4 font-medium text-foreground-muted">
          {title} — coming soon
        </p>
        <p className="mt-1 text-sm text-subtle">
          This module is wired into the navigation and ready for its UI.
        </p>
      </div>
    </AdminPageLayout>
  );
}
