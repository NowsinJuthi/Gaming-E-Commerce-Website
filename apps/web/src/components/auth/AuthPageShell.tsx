import type { ReactNode } from "react";
import { LoginShieldGraphic } from "@/app/(auth)/login/LoginShieldGraphic";
import styles from "@/app/(auth)/login/login.module.css";

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page}>
      <svg
        className={`${styles.scribble} ${styles.scribbleTop}`}
        viewBox="0 0 160 70"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 42 C28 8, 58 62, 88 22 S138 8, 152 36"
          stroke="#26BFB0"
          strokeWidth="1.4"
        />
        <circle cx="24" cy="18" r="3" fill="#26BFB0" />
        <circle cx="118" cy="12" r="2.2" fill="#5EEAD4" />
      </svg>
      <svg
        className={`${styles.scribble} ${styles.scribbleBottom}`}
        viewBox="0 0 180 80"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M10 48 C40 8, 70 72, 110 28 S160 18, 172 50"
          stroke="#0A6258"
          strokeWidth="1.4"
        />
        <polygon points="150,18 158,32 142,32" stroke="#26BFB0" fill="none" />
      </svg>

      <div className={styles.card}>
        <div className={styles.art} aria-hidden="true">
          <LoginShieldGraphic className={styles.shield} />
        </div>
        <div className={styles.right}>
          <div className={styles.formPanel}>{children}</div>
        </div>
      </div>
    </main>
  );
}
