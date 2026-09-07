import { HOME_PAGE_BG } from "@/components/home/home-container";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={HOME_PAGE_BG}>{children}</div>;
}
