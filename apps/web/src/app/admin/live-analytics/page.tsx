import { redirect } from "next/navigation";

/** Live visitors merged into Movie Server dashboard. */
export default function LiveAnalyticsAdminRedirect() {
  redirect("/admin/movie-server");
}
