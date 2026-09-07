export type StackItem = {
  label: string;
  value: string;
};

export type StackGroup = {
  title: string;
  subtitle: string;
  items: StackItem[];
  tags?: string[];
};

export const WEBSITE_STACK: {
  frontend: StackGroup;
  backend: StackGroup;
  infrastructure: StackGroup;
} = {
  frontend: {
    title: "Frontend",
    subtitle: "Customer storefront + admin panel (apps/web)",
    items: [
      { label: "Language", value: "TypeScript" },
      { label: "Framework", value: "Next.js 15 (App Router)" },
      { label: "UI library", value: "React 19" },
      { label: "Styling", value: "Tailwind CSS 3 + custom CSS" },
      { label: "Data fetching", value: "TanStack React Query" },
      { label: "State", value: "Zustand" },
      { label: "Realtime", value: "Socket.IO Client" },
      { label: "Dev port", value: "http://localhost:3000" },
    ],
    tags: ["Next.js", "React", "Tailwind", "TypeScript", "React Query", "Zustand"],
  },
  backend: {
    title: "Backend",
    subtitle: "REST API + jobs + realtime (apps/api)",
    items: [
      { label: "Language", value: "TypeScript" },
      { label: "Framework", value: "NestJS 11" },
      { label: "Runtime", value: "Node.js 20+" },
      { label: "Database", value: "MongoDB 7 (Mongoose)" },
      { label: "Cache / queue", value: "Redis 7 + BullMQ" },
      { label: "Auth", value: "Passport + JWT" },
      { label: "Realtime", value: "Socket.IO + Redis adapter" },
      { label: "API docs", value: "Swagger (/api/docs)" },
      { label: "Dev port", value: "http://localhost:4000/api" },
    ],
    tags: ["NestJS", "MongoDB", "Redis", "BullMQ", "JWT", "Socket.IO"],
  },
  infrastructure: {
    title: "Infrastructure & integrations",
    subtitle: "Monorepo, Docker, payments, suppliers",
    items: [
      { label: "Monorepo", value: "pnpm workspaces + Turborepo" },
      { label: "Containers", value: "Docker Compose (MongoDB, Redis, API)" },
      { label: "Payments", value: "bKash, Nagad, Rocket, Upay, UddoktaPay" },
      { label: "Suppliers", value: "Reloadly, Xsolla, Turgame, Foxreload" },
      { label: "Security", value: "Helmet, reCAPTCHA, Cloudflare" },
      { label: "Notifications", value: "Email, Push, Telegram" },
      { label: "Logging", value: "Pino" },
      { label: "Testing", value: "Jest, Playwright" },
    ],
    tags: ["Docker", "pnpm", "Turborepo", "TypeScript"],
  },
};
