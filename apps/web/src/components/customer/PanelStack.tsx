import type { ReactNode } from "react";

export function PanelStack({ children }: { children: ReactNode }) {
  return <div className="panel-page-stack">{children}</div>;
}

export function PanelStackTop({ children }: { children: ReactNode }) {
  return <div className="panel-stack-top">{children}</div>;
}

export function PanelStackBottom({ children }: { children: ReactNode }) {
  return <div className="panel-stack-bottom">{children}</div>;
}
