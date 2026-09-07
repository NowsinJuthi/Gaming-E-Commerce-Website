import { resolveLogoSrc, type SiteAppearance } from "@/lib/site-appearance";
import { SITE_COPYRIGHT } from "@/lib/seo";
import type {
  EmailLogoSource,
  EmailSettingsView,
  EmailTemplateItem,
} from "@/lib/api";

export interface EmailPreviewBranding {
  storeName: string;
  tagline: string;
  primaryColor: string;
  footerText: string;
  logoUrl?: string;
}

export interface EmailPreviewContent {
  subject: string;
  sectionLabel: string;
  heading: string;
  greeting: string;
  paragraphs: string[];
  metaLines: string[];
  button: { label: string; url: string } | null;
  usesBuiltIn: boolean;
}

export const EMAIL_PREVIEW_VARS = {
  store_name: "UniQbd",
  store_url: "https://uniqbd.com",
  customer_name: "Jane Customer",
  order_number: "1234",
  order_id: "1234",
  order_total: "৳49.99",
  verification_code: "847291",
  reset_url: "https://uniqbd.com/reset",
  verify_url: "https://uniqbd.com/verify",
  note_message:
    "We need a few more details before we can deliver your digital keys.",
  chat_message:
    "Thanks for reaching out! Your top-up has been processed — please check your account.",
  chat_url: "https://uniqbd.com/chat",
  product_name: "Steam Wallet Gift Card 500 BDT",
  reply_message:
    "Good news — we have added this product to our catalog. You can order it now from our store.",
  inquiry_subject: "Order delivery issue",
  failure_reason:
    "Your card was declined. Please try another payment method.",
} satisfies Record<string, string>;

type BuiltinPreview = {
  sectionLabel?: string;
  heading: string;
  paragraphs: string[];
  metaLines?: string[];
  button?: { label: string; url: string };
  greeting?: string;
};

const BUILTIN_PREVIEW: Record<string, BuiltinPreview> = {
  "order.new_admin": {
    sectionLabel: "ADMIN ALERT",
    heading: "New order received",
    greeting: "Hi there,",
    paragraphs: [
      "A new order has been placed on {{store_name}}.",
      "Customer: {{customer_name}} · Order #{{order_number}}",
    ],
    metaLines: ["Order #{{order_number}} · {{order_total}}"],
    button: { label: "Open in admin", url: "/admin/sales/orders/{{order_id}}" },
  },
  "order.pending": {
    heading: "Complete your payment",
    paragraphs: [
      "Thanks for your order! Complete payment to receive your digital delivery.",
      "Order #{{order_number}} · {{order_total}}",
    ],
    metaLines: ["Awaiting payment"],
    button: { label: "Pay now", url: "/orders/{{order_id}}" },
  },
  "order.cancelled": {
    heading: "Order cancelled",
    paragraphs: [
      "Your order #{{order_number}} was cancelled. No codes were delivered for this purchase.",
    ],
    metaLines: [
      "Order #{{order_number}} · Processing",
      "Loot value: {{order_total}}",
    ],
  },
  "order.processing": {
    heading: "Order processing",
    paragraphs: [
      "Thanks for your order! We're preparing your digital keys for delivery.",
      "Order #{{order_number}} is now being processed.",
    ],
    metaLines: ["Order #{{order_number}} · {{order_total}}"],
    button: { label: "View order", url: "/orders/{{order_id}}" },
  },
  "order.completed": {
    heading: "Your order is complete!",
    paragraphs: [
      "Your order #{{order_number}} is complete. Your digital delivery is ready.",
    ],
    metaLines: ["Order #{{order_number}}"],
    button: { label: "View order details", url: "/orders/{{order_id}}" },
  },
  "order.refunded": {
    heading: "Refund processed",
    paragraphs: [
      "We've processed a refund for order #{{order_number}}. Funds may take a few days to appear.",
    ],
    metaLines: ["Refund amount: {{order_total}}"],
  },
  "order.on_hold": {
    heading: "Order on hold",
    paragraphs: [
      "Your order #{{order_number}} is on hold while we review the details.",
      "{{note_message}}",
    ],
    metaLines: ["Order #{{order_number}} · On hold"],
  },
  "order.paid": {
    heading: "Thank you for your order!",
    paragraphs: [
      "Your payment was received successfully. We're preparing your digital delivery now.",
      "Order #{{order_number}} · {{order_total}}",
    ],
    metaLines: ["Payment confirmed · Customer receipt"],
    button: { label: "Continue shopping", url: "{{store_url}}/products" },
  },
  "order.invoice": {
    heading: "Thank you for your order!",
    paragraphs: [
      "Your payment was received successfully. We're preparing your digital delivery now.",
      "Order #{{order_number}} · {{order_total}}",
    ],
    metaLines: ["Payment confirmed · Customer receipt"],
    button: { label: "Continue shopping", url: "{{store_url}}/products" },
  },
  "order.failed": {
    heading: "Payment failed",
    paragraphs: [
      "We couldn't process payment for order #{{order_number}}.",
      "{{failure_reason}}",
    ],
    metaLines: ["Order #{{order_number}} · Unpaid"],
    button: { label: "Retry payment", url: "/orders/{{order_id}}" },
  },
  "order.customer_note": {
    heading: "Update on your order",
    paragraphs: ["{{note_message}}"],
    metaLines: ["Order #{{order_number}}"],
    button: { label: "View order details", url: "/orders/{{order_id}}" },
  },
  "order.gift_card": {
    heading: "Your gift card",
    paragraphs: [
      "Your gift card from order #{{order_number}} is ready.",
      "Redeem it at checkout on your next purchase.",
    ],
    metaLines: ["Order #{{order_number}} · Gift card"],
  },
  "account.verify_email": {
    sectionLabel: "ACCOUNT UPDATE",
    heading: "Verify your email",
    paragraphs: [
      "Please confirm your email address to secure your {{store_name}} account.",
      "Your verification code is {{verification_code}}.",
    ],
    button: { label: "Verify email", url: "{{verify_url}}" },
  },
  "account.new_account": {
    sectionLabel: "ACCOUNT UPDATE",
    heading: "Welcome aboard",
    paragraphs: [
      "Welcome to {{store_name}}! Your account is ready — browse premium digital keys and gift cards with instant delivery.",
    ],
    button: { label: "Start shopping", url: "{{store_url}}" },
  },
  "account.reset_password": {
    sectionLabel: "ACCOUNT UPDATE",
    heading: "Reset your password",
    paragraphs: [
      "We received a request to reset your {{store_name}} password.",
      "If you didn't request this, you can safely ignore this email.",
    ],
    button: { label: "Reset password", url: "{{reset_url}}" },
  },
  "account.chat_reply": {
    sectionLabel: "ACCOUNT UPDATE",
    heading: "Support replied",
    paragraphs: [
      "Our support team replied to your live chat conversation on {{store_name}}.",
      "{{chat_message}}",
    ],
    button: { label: "Open live chat", url: "{{chat_url}}" },
  },
  "account.product_request_reply": {
    sectionLabel: "ACCOUNT UPDATE",
    heading: "Product request update",
    paragraphs: [
      "Thanks for your product request for {{product_name}} on {{store_name}}. Here is our reply:",
      "{{reply_message}}",
    ],
  },
  "account.contact_inquiry_reply": {
    sectionLabel: "ACCOUNT UPDATE",
    heading: "Support reply",
    paragraphs: [
      "Thank you for contacting {{store_name}} about {{inquiry_subject}}. Here is our reply:",
      "{{reply_message}}",
    ],
  },
  "system.smtp_test": {
    sectionLabel: "SYSTEM",
    heading: "SMTP test email",
    greeting: "Hi there,",
    paragraphs: [
      "This is a test email from {{store_name}}.",
      "If you received this, your SMTP configuration is working correctly.",
    ],
  },
};

export function hasCustomEmailTemplateContent(
  template: Pick<EmailTemplateItem, "heading" | "bodyText">,
): boolean {
  return Boolean(template.heading.trim() || template.bodyText.trim());
}

export function usesBuiltInRichHtmlPreview(template: EmailTemplateItem): boolean {
  return (
    (template.id === "order.paid" ||
      template.id === "order.invoice" ||
      template.id === "order.completed") &&
    !hasCustomEmailTemplateContent(template)
  );
}

export function interpolateEmailTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key];
    return value ?? `{{${key}}}`;
  });
}

export function buildEmailPreviewContent(
  form: EmailTemplateItem,
  branding: EmailPreviewBranding,
): EmailPreviewContent {
  const vars = {
    ...EMAIL_PREVIEW_VARS,
    store_name: branding.storeName || EMAIL_PREVIEW_VARS.store_name,
  };

  const defaultSection =
    form.recipient === "admin"
      ? "ADMIN ALERT"
      : form.category === "account"
        ? "ACCOUNT UPDATE"
        : form.category === "system"
          ? "SYSTEM"
          : "PLAYER NOTIFICATION";

  const hasCustom = Boolean(form.heading.trim() || form.bodyText.trim());

  if (hasCustom) {
    const heading = interpolateEmailTemplate(
      form.heading.trim() || form.label,
      vars,
    );
    const paragraphs = form.bodyText.trim()
      ? form.bodyText
          .split(/\n+/)
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p) => interpolateEmailTemplate(p, vars))
      : [
          `Preview of your ${form.label.toLowerCase()} message with sample data.`,
        ];

    return {
      subject: interpolateEmailTemplate(form.subject, vars),
      sectionLabel: defaultSection,
      heading,
      greeting:
        form.recipient === "admin"
          ? "Hi there,"
          : `Hey ${vars.customer_name},`,
      paragraphs,
      metaLines: [],
      button: form.buttonLabel.trim()
        ? {
            label: interpolateEmailTemplate(form.buttonLabel, vars),
            url: interpolateEmailTemplate(form.buttonUrl, vars),
          }
        : null,
      usesBuiltIn: false,
    };
  }

  const builtin = BUILTIN_PREVIEW[form.id];
  if (builtin) {
    return {
      subject: interpolateEmailTemplate(form.subject, vars),
      sectionLabel: builtin.sectionLabel ?? defaultSection,
      heading: interpolateEmailTemplate(builtin.heading, vars),
      greeting:
        builtin.greeting ??
        (form.recipient === "admin"
          ? "Hi there,"
          : `Hey ${vars.customer_name},`),
      paragraphs: builtin.paragraphs.map((p) => interpolateEmailTemplate(p, vars)),
      metaLines: (builtin.metaLines ?? []).map((m) =>
        interpolateEmailTemplate(m, vars),
      ),
      button: builtin.button
        ? {
            label: interpolateEmailTemplate(builtin.button.label, vars),
            url: interpolateEmailTemplate(builtin.button.url, vars),
          }
        : form.buttonLabel.trim()
          ? {
              label: interpolateEmailTemplate(form.buttonLabel, vars),
              url: interpolateEmailTemplate(form.buttonUrl, vars),
            }
          : null,
      usesBuiltIn: true,
    };
  }

  return {
    subject: interpolateEmailTemplate(form.subject, vars),
    sectionLabel: defaultSection,
    heading: form.label,
    greeting: `Hey ${vars.customer_name},`,
    paragraphs: [form.description],
    metaLines: [],
    button: null,
    usesBuiltIn: true,
  };
}

export const DEFAULT_EMAIL_PREVIEW_BRANDING: EmailPreviewBranding = {
  storeName: "UniQbd",
  tagline: "Premium digital keys & gift cards — instant delivery",
  primaryColor: "#38bfb0",
  footerText: SITE_COPYRIGHT,
};

export function resolveStoredEmailLogoSource(
  settings: Pick<EmailSettingsView, "emailLogoSource" | "logoUrl">,
): EmailLogoSource {
  const stored = settings.emailLogoSource;
  if (
    stored === "light" ||
    stored === "dark" ||
    stored === "system" ||
    stored === "custom"
  ) {
    return stored;
  }
  if (settings.logoUrl.trim()) return "custom";
  return "system";
}

export function resolveEmailLogoSrc(
  settings: Pick<EmailSettingsView, "emailLogoSource" | "logoUrl">,
  appearance?: Pick<
    SiteAppearance,
    "logoUrlLight" | "logoUrlDark" | "defaultTheme"
  >,
): string {
  const source = resolveStoredEmailLogoSource(settings);
  if (source === "custom") {
    const custom = settings.logoUrl.trim();
    return custom ? resolveLogoSrc(custom) : "";
  }
  if (!appearance) return "";

  const light = appearance.logoUrlLight.trim();
  const dark = appearance.logoUrlDark.trim();

  switch (source) {
    case "light":
      return resolveLogoSrc(light || dark);
    case "dark":
      return resolveLogoSrc(dark || light);
    case "system":
    default: {
      const theme = appearance.defaultTheme;
      if (theme === "light") return resolveLogoSrc(light || dark);
      if (theme === "dark") return resolveLogoSrc(dark || light);
      return resolveLogoSrc(dark || light);
    }
  }
}

export function resolveEmailBranding(
  settings: Pick<
    EmailSettingsView,
    "fromName" | "emailLogoSource" | "logoUrl" | "footerText" | "primaryColor"
  >,
  appearance?: Pick<
    SiteAppearance,
    "logoUrlLight" | "logoUrlDark" | "defaultTheme"
  >,
): EmailPreviewBranding {
  const resolvedLogo = resolveEmailLogoSrc(settings, appearance);
  return {
    storeName:
      settings.fromName.trim() || DEFAULT_EMAIL_PREVIEW_BRANDING.storeName,
    tagline: DEFAULT_EMAIL_PREVIEW_BRANDING.tagline,
    primaryColor:
      settings.primaryColor.trim() ||
      DEFAULT_EMAIL_PREVIEW_BRANDING.primaryColor,
    footerText:
      settings.footerText.trim() || DEFAULT_EMAIL_PREVIEW_BRANDING.footerText,
    logoUrl: resolvedLogo || undefined,
  };
}
