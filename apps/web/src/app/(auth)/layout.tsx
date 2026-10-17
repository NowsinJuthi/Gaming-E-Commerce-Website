import { AuthPageShell } from "@/components/auth/AuthPageShell";

export default function AuthRoutesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthPageShell>{children}</AuthPageShell>;
}
