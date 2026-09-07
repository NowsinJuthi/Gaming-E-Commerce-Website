import type { Metadata } from "next";
import AccountClientLayout from "./AccountClientLayout";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AccountClientLayout>{children}</AccountClientLayout>;
}
