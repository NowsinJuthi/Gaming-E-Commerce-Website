import { EffectiveEmailSettings } from './email-settings.service';

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface EmailOrderItem {
  title: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string;
  customerInputs?: Array<{ label: string; value: string }>;
}

export function normalizeEmailOrderCustomerInputs(
  inputs?: ReadonlyArray<{
    label?: string;
    value?: string;
    fieldLabel?: string;
    name?: string;
  }>,
): Array<{ label: string; value: string }> {
  if (!inputs?.length) return [];
  return inputs
    .map((raw) => {
      const label = String(
        raw.label ?? raw.fieldLabel ?? raw.name ?? '',
      ).trim();
      const value = String(raw.value ?? '').trim();
      if (!label || !value) return null;
      return {
        label: label.slice(0, 120),
        value: value.slice(0, 2000),
      };
    })
    .filter((entry): entry is { label: string; value: string } => entry !== null);
}

export function toEmailOrderItems(
  items: Array<{
    title: string;
    quantity: number;
    unitPrice: number;
    imageUrl?: string;
    customerInputs?: ReadonlyArray<{
      label?: string;
      value?: string;
      fieldLabel?: string;
      name?: string;
    }>;
  }>,
): EmailOrderItem[] {
  return (items ?? []).map((it) => {
    const customerInputs = normalizeEmailOrderCustomerInputs(it.customerInputs);

    return {
      title: it.title,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      ...(it.imageUrl?.trim() ? { imageUrl: it.imageUrl.trim() } : {}),
      ...(customerInputs.length > 0 ? { customerInputs } : {}),
    };
  });
}

function parseOrderLineTitle(title: string): {
  productTitle: string;
  packageName?: string;
} {
  const match = title.match(/^(.+?)\s+\((.+)\)$/);
  if (!match) {
    return { productTitle: title.trim() };
  }
  const packageName = match[2]?.trim() ?? '';
  if (/^\d+$/.test(packageName)) {
    return { productTitle: match[1]?.trim() ?? title.trim() };
  }
  return {
    productTitle: match[1]?.trim() ?? title.trim(),
    packageName,
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMoney(amount: number, currency = 'BDT'): string {
  const value = Number(amount ?? 0);
  const code = (currency?.trim() || 'BDT').toUpperCase();
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return code === 'BDT' ? `${formatted}\u00A0৳` : `${code} ${formatted}`;
}

function absoluteUrl(settings: EffectiveEmailSettings, path: string): string {
  if (!path) return settings.webUrl;
  if (/^https?:\/\//i.test(path)) return path;
  return `${settings.webUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Absolute URL for images and uploads — routes /api/uploads via storefront (Next proxy). */
export function emailAssetUrl(
  settings: EffectiveEmailSettings,
  path?: string,
): string | undefined {
  const raw = path?.trim();
  if (!raw) return undefined;

  const webBase = settings.webUrl.replace(/\/$/, '');
  const apiUploadsPath = extractApiUploadsPath(raw);
  if (apiUploadsPath) {
    return `${webBase}${apiUploadsPath}`;
  }

  if (/^(https?:|data:|cid:)/i.test(raw)) {
    return raw;
  }

  const normalized = raw.startsWith('/') ? raw : `/${raw}`;

  if (normalized.startsWith('/api/uploads/')) {
    return `${webBase}${normalized}`;
  }

  if (normalized.includes('/uploads/')) {
    if (normalized.startsWith('/uploads/')) {
      const prefix = (settings.apiGlobalPrefix || 'api').replace(/^\/+|\/+$/g, '');
      return `${webBase}/${prefix}${normalized}`;
    }
    return `${webBase}${normalized}`;
  }

  return `${webBase}${normalized}`;
}

function extractApiUploadsPath(raw: string): string | null {
  const match = raw.match(/(\/api\/uploads\/[^?\s#]*)/i);
  return match?.[1] ?? null;
}

function emailImageTag(
  settings: EffectiveEmailSettings,
  src: string,
  opts: { width: number; height: number; alt?: string },
): string {
  const resolved = emailAssetUrl(settings, src) ?? src;
  const w = opts.width;
  const h = opts.height;
  return `<img src="${escapeHtml(resolved)}" alt="${escapeHtml(opts.alt ?? '')}" width="${w}" height="${h}" border="0" style="display:block;width:${w}px;height:${h}px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />`;
}

function emailLogoTag(
  settings: EffectiveEmailSettings,
  src: string,
  alt: string,
): string {
  const resolved = emailAssetUrl(settings, src) ?? src;
  return `<img src="${escapeHtml(resolved)}" alt="${escapeHtml(alt)}" height="40" border="0" style="display:block;height:40px;max-height:40px;width:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />`;
}

/** Branded CTA button (bulletproof, table-based for Outlook). */
function button(
  settings: EffectiveEmailSettings,
  label: string,
  url: string,
): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td align="center" bgcolor="${escapeHtml(settings.primaryColor)}" style="border-radius:10px;">
        <a href="${escapeHtml(url)}" target="_blank"
           style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background:${escapeHtml(settings.primaryColor)};">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;
}

function itemsTable(items: EmailOrderItem[], currency: string): string {
  if (!items?.length) return '';
  const rows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #eef1f4;font-size:14px;color:#1f2937;">
          ${escapeHtml(it.title)}
          <span style="color:#6b7280;"> × ${escapeHtml(it.quantity)}</span>
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #eef1f4;font-size:14px;color:#1f2937;white-space:nowrap;">
          ${escapeHtml(formatMoney(it.unitPrice * it.quantity, currency))}
        </td>
      </tr>`,
    )
    .join('');
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
    ${rows}
  </table>`;
}

function infoBox(html: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin:16px 0;background:#f6f8fa;border:1px solid #eef1f4;border-radius:10px;">
    <tr><td style="padding:16px 18px;font-size:14px;color:#374151;line-height:1.6;">${html}</td></tr>
  </table>`;
}

/**
 * Reusable responsive email layout. Uses a light card on a neutral backdrop
 * with high-contrast text so it renders consistently across light and dark
 * mail clients. All CSS is inlined for maximum client support.
 */
export function renderLayout(
  settings: EffectiveEmailSettings,
  opts: { previewText?: string; heading: string; bodyHtml: string },
): string {
  const logo = settings.logoUrl
    ? emailLogoTag(settings, settings.logoUrl, settings.fromName)
    : `<span style="font-size:24px;font-weight:800;color:${escapeHtml(settings.primaryColor)};letter-spacing:-0.02em;">${escapeHtml(settings.fromName)}</span>`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#eef1f4;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.previewText ?? opts.heading)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f4;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(15,23,42,0.06);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <tr>
            <td align="center" style="padding:28px 32px 8px;border-bottom:1px solid #eef1f4;">
              ${logo}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;font-weight:800;color:#0f172a;">${escapeHtml(opts.heading)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 8px;font-size:15px;line-height:1.65;color:#374151;">
              ${opts.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 28px;border-top:1px solid #eef1f4;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#9aa3af;">
                ${escapeHtml(settings.footerText)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function wrap(
  settings: EffectiveEmailSettings,
  subject: string,
  heading: string,
  bodyHtml: string,
  text: string,
  previewText?: string,
): EmailContent {
  return {
    subject,
    html: renderLayout(settings, { heading, bodyHtml, previewText }),
    text,
  };
}

const greeting = (name?: string): string =>
  `<p style="margin:0 0 14px;">Hi ${escapeHtml(name?.trim() || 'there')},</p>`;

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function welcomeEmail(
  settings: EffectiveEmailSettings,
  data: { name?: string },
): EmailContent {
  const body = `
    ${greeting(data.name)}
    <p style="margin:0 0 14px;">Welcome to <strong>${escapeHtml(settings.fromName)}</strong>! Your account is ready and you can start exploring instant digital products right away.</p>
    ${button(settings, 'Start shopping', settings.webUrl)}
    <p style="margin:0;color:#6b7280;">Need help getting started? Just reply to this email — we're happy to help.</p>`;
  return wrap(
    settings,
    `Welcome to ${settings.fromName}`,
    `Welcome to ${settings.fromName} 🎉`,
    body,
    `Hi ${data.name ?? 'there'}, welcome to ${settings.fromName}! Visit ${settings.webUrl} to start shopping.`,
    `Your ${settings.fromName} account is ready`,
  );
}

export function emailVerificationEmail(
  settings: EffectiveEmailSettings,
  data: { name?: string; code?: string; verifyUrl?: string },
): EmailContent {
  const codeBlock = data.code
    ? infoBox(
        `<span style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:6px;">Your verification code</span>
         <span style="font-size:28px;font-weight:800;letter-spacing:0.18em;color:#0f172a;">${escapeHtml(data.code)}</span>`,
      )
    : '';
  const cta = data.verifyUrl
    ? button(settings, 'Verify email', absoluteUrl(settings, data.verifyUrl))
    : '';
  const body = `
    ${greeting(data.name)}
    <p style="margin:0 0 14px;">Confirm your email address to activate your ${escapeHtml(settings.fromName)} account.</p>
    ${codeBlock}
    ${cta}
    <p style="margin:0;color:#6b7280;">This code expires shortly. If you didn't create an account, you can ignore this email.</p>`;
  return wrap(
    settings,
    'Verify your email',
    'Verify your email address',
    body,
    `Your ${settings.fromName} verification code is ${data.code ?? ''}. ${data.verifyUrl ? `Verify: ${absoluteUrl(settings, data.verifyUrl)}` : ''}`,
    'Confirm your email to activate your account',
  );
}

export function otpLoginEmail(
  settings: EffectiveEmailSettings,
  data: { name?: string; code: string },
): EmailContent {
  const codeBlock = infoBox(
    `<span style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:6px;">Your login code</span>
     <span style="font-size:28px;font-weight:800;letter-spacing:0.18em;color:#0f172a;">${escapeHtml(data.code)}</span>`,
  );
  const body = `
    ${greeting(data.name)}
    <p style="margin:0 0 14px;">Use the code below to sign in to your <strong>${escapeHtml(settings.fromName)}</strong> account.</p>
    ${codeBlock}
    <p style="margin:0;color:#6b7280;">This code expires in 5 minutes. If you didn't request this, you can safely ignore this email.</p>`;
  return wrap(
    settings,
    `Your ${settings.fromName} login code`,
    'Sign in to your account',
    body,
    `Your ${settings.fromName} login code is ${data.code}. It expires in 5 minutes.`,
    'Your one-time login code',
  );
}

export function passwordResetEmail(
  settings: EffectiveEmailSettings,
  data: { name?: string; resetUrl?: string; code?: string },
): EmailContent {
  const codeBlock = data.code
    ? infoBox(
        `<span style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:6px;">Reset code</span>
         <span style="font-size:28px;font-weight:800;letter-spacing:0.18em;color:#0f172a;">${escapeHtml(data.code)}</span>`,
      )
    : '';
  const cta = data.resetUrl
    ? button(settings, 'Reset password', absoluteUrl(settings, data.resetUrl))
    : '';
  const body = `
    ${greeting(data.name)}
    <p style="margin:0 0 14px;">We received a request to reset your password. Use the option below to choose a new one.</p>
    ${codeBlock}
    ${cta}
    <p style="margin:0;color:#6b7280;">If you didn't request this, please ignore this email — your password will stay the same.</p>`;
  return wrap(
    settings,
    'Reset your password',
    'Reset your password',
    body,
    `Reset your ${settings.fromName} password. ${data.resetUrl ? `Link: ${absoluteUrl(settings, data.resetUrl)}` : ''} ${data.code ? `Code: ${data.code}` : ''}`,
    'Password reset request',
  );
}

export function orderConfirmationEmail(
  settings: EffectiveEmailSettings,
  data: {
    name?: string;
    orderNumber: string;
    items?: EmailOrderItem[];
    total: number;
    currency?: string;
    orderUrl?: string;
  },
): EmailContent {
  const currency = data.currency ?? 'BDT';
  const body = `
    ${greeting(data.name)}
    <p style="margin:0 0 6px;">Thanks for your order! We've received <strong>${escapeHtml(data.orderNumber)}</strong> and it's now being processed.</p>
    ${itemsTable(data.items ?? [], currency)}
    ${infoBox(`<strong style="color:#0f172a;">Order total</strong><span style="float:right;font-weight:800;color:#0f172a;">${escapeHtml(formatMoney(data.total, currency))}</span>`)}
    ${data.orderUrl ? button(settings, 'View your order', absoluteUrl(settings, data.orderUrl)) : ''}
    <p style="margin:0;color:#6b7280;">We'll email you again as soon as your order status changes.</p>`;
  return wrap(
    settings,
    `Order ${data.orderNumber} confirmed`,
    'Your order is confirmed ✅',
    body,
    `Order ${data.orderNumber} confirmed. Total: ${formatMoney(data.total, currency)}.`,
    `We received order ${data.orderNumber}`,
  );
}

export function orderPendingEmail(
  settings: EffectiveEmailSettings,
  data: {
    name?: string;
    orderNumber: string;
    items?: EmailOrderItem[];
    total: number;
    currency?: string;
    orderUrl?: string;
  },
): EmailContent {
  const currency = data.currency ?? 'BDT';
  const body = `
    ${greeting(data.name)}
    <p style="margin:0 0 6px;">We've received your order <strong>${escapeHtml(data.orderNumber)}</strong>. Complete your payment to confirm it.</p>
    ${itemsTable(data.items ?? [], currency)}
    ${infoBox(`<strong style="color:#0f172a;">Amount due</strong><span style="float:right;font-weight:800;color:#0f172a;">${escapeHtml(formatMoney(data.total, currency))}</span>`)}
    ${data.orderUrl ? button(settings, 'Complete payment', absoluteUrl(settings, data.orderUrl)) : ''}
    <p style="margin:0;color:#6b7280;">Your order stays on hold until payment is received. We'll email you again once it's confirmed.</p>`;
  return wrap(
    settings,
    `Order ${data.orderNumber} — payment pending`,
    'Complete your order payment',
    body,
    `Order ${data.orderNumber} is awaiting payment. Total: ${formatMoney(data.total, currency)}.`,
    `Order ${data.orderNumber} is awaiting payment`,
  );
}

export function orderCustomerNoteEmail(
  settings: EffectiveEmailSettings,
  data: {
    name?: string;
    orderNumber: string;
    message: string;
    orderUrl?: string;
  },
): EmailContent {
  const body = `
    ${greeting(data.name)}
    <p style="margin:0 0 14px;">You have a new message regarding your order <strong>${escapeHtml(data.orderNumber)}</strong>.</p>
    ${infoBox(`<span style="color:#374151;white-space:pre-line;">${escapeHtml(data.message).replace(/\n/g, '<br/>')}</span>`)}
    ${data.orderUrl ? button(settings, 'View order details', absoluteUrl(settings, data.orderUrl)) : ''}`;
  return wrap(
    settings,
    `Note added to order ${data.orderNumber}`,
    'A message from us',
    body,
    `Order ${data.orderNumber} — ${data.message}`,
    `Note for order ${data.orderNumber}`,
  );
}

export function chatReplyEmail(
  settings: EffectiveEmailSettings,
  data: { name?: string; message: string; chatUrl?: string },
): EmailContent {
  const body = `
    ${greeting(data.name)}
    <p style="margin:0 0 14px;">Our support team replied to your live chat conversation on <strong>${escapeHtml(settings.fromName)}</strong>.</p>
    ${infoBox(`<span style="color:#374151;white-space:pre-line;">${escapeHtml(data.message).replace(/\n/g, '<br/>')}</span>`)}
    ${button(settings, 'Open live chat', absoluteUrl(settings, data.chatUrl || '/chat'))}
    <p style="margin:0;color:#6b7280;">Open the chat to continue the conversation.</p>`;
  return wrap(
    settings,
    `Support replied to your live chat — ${settings.fromName}`,
    'Support replied',
    body,
    `Support replied to your live chat: ${data.message}`,
    'New reply in your live chat',
  );
}

export function productRequestReplyEmail(
  settings: EffectiveEmailSettings,
  data: { name?: string; productName: string; message: string },
): EmailContent {
  const body = `
    ${greeting(data.name)}
    <p style="margin:0 0 14px;">Thanks for your product request for <strong>${escapeHtml(data.productName)}</strong> on <strong>${escapeHtml(settings.fromName)}</strong>. Here is our reply:</p>
    ${infoBox(`<span style="color:#374151;white-space:pre-line;">${escapeHtml(data.message).replace(/\n/g, '<br/>')}</span>`)}
    <p style="margin:0;color:#6b7280;">If you have any questions, just reply to this email or contact our support team.</p>`;
  return wrap(
    settings,
    `Reply to your product request — ${settings.fromName}`,
    'Product request update',
    body,
    `Reply to your product request for ${data.productName}: ${data.message}`,
    `Update on your ${data.productName} request`,
  );
}

export function contactInquiryReplyEmail(
  settings: EffectiveEmailSettings,
  data: { name?: string; subject: string; message: string },
): EmailContent {
  const body = `
    ${greeting(data.name)}
    <p style="margin:0 0 14px;">Thank you for contacting <strong>${escapeHtml(settings.fromName)}</strong> about <strong>${escapeHtml(data.subject)}</strong>. Here is our reply:</p>
    ${infoBox(`<span style="color:#374151;white-space:pre-line;">${escapeHtml(data.message).replace(/\n/g, '<br/>')}</span>`)}
    <p style="margin:0;color:#6b7280;">If you need more help, reply to this email or visit our support page.</p>`;
  return wrap(
    settings,
    `Re: ${data.subject} — ${settings.fromName}`,
    'Support reply',
    body,
    `Re: ${data.subject}\n\n${data.message}`,
    `Reply from ${settings.fromName}`,
  );
}

function orderPaidDarkGreeting(
  theme: OrderPaidEmailTheme,
  name?: string,
): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${theme.fgMuted};">Hi ${escapeHtml(name?.trim() || 'there')},</p>`;
}

function orderCompletedMobileWhiteStyles(theme: OrderPaidEmailTheme): string {
  return `<style type="text/css">
@media only screen and (max-width: 600px) {
  .order-complete-email,
  .order-complete-email p,
  .order-complete-email h1,
  .order-complete-email td,
  .order-complete-email span,
  .order-complete-email div {
    color: #ffffff !important;
  }
  .order-complete-email .order-complete-accent {
    color: ${theme.brand} !important;
  }
  .order-complete-email .order-complete-success {
    color: ${theme.success} !important;
  }
  .order-complete-email-footer {
    color: #ffffff !important;
  }
}
@media (prefers-color-scheme: light) {
  body.order-receipt-email-body,
  .order-receipt-email-shell,
  .order-receipt-email-logo {
    background-color: ${theme.bg} !important;
    background-image: none !important;
  }
}
</style>`;
}

/** Lock outer receipt shell (logo backdrop, body, card) across mobile + light/dark inbox modes. */
function orderReceiptShellColorLockStyles(theme: OrderPaidEmailTheme): string {
  const rules = `
  body.order-receipt-email-body,
  .order-receipt-email-shell,
  .order-receipt-email-logo {
    background-color: ${theme.bg} !important;
    background-image: none !important;
  }
  .order-receipt-email-card {
    background-color: ${theme.bgElevated} !important;
    background-image: none !important;
    border-color: rgba(${theme.brandRgb},0.12) !important;
  }
  .order-receipt-email-footer {
    background-color: transparent !important;
    background-image: none !important;
  }`;

  return `<style type="text/css">
:root {
  color-scheme: dark;
  supported-color-schemes: dark;
}
${rules}
@media only screen and (max-width: 600px) {
${rules}
}
@media (prefers-color-scheme: light) {
${rules}
}
@media (prefers-color-scheme: dark) {
${rules}
}
</style>`;
}

/** Lock invoice/receipt section colors — mobile + light/dark inbox modes must not invert them. */
function orderPaidEmailColorLockStyles(theme: OrderPaidEmailTheme): string {
  const sunkenBg = theme.bgSunken;
  const sunkenBorder = theme.border;
  const mutedBg = theme.bgMuted;
  const rules = `
  .order-paid-email .order-paid-section-title,
  .order-paid-email .order-paid-detail-label,
  .order-paid-email .order-paid-fg-muted {
    color: ${theme.fgMuted} !important;
    -webkit-text-fill-color: ${theme.fgMuted} !important;
  }
  .order-paid-email .order-paid-detail-value,
  .order-paid-email .order-paid-fg,
  .order-paid-email .order-paid-item-title {
    color: ${theme.fg} !important;
    -webkit-text-fill-color: ${theme.fg} !important;
  }
  .order-paid-email .order-paid-brand {
    color: ${theme.brand} !important;
    -webkit-text-fill-color: ${theme.brand} !important;
  }
  .order-paid-email .order-paid-panel,
  .order-paid-email .order-paid-detail-grid,
  .order-paid-email .order-paid-item-card {
    background-color: ${sunkenBg} !important;
    border-color: ${sunkenBorder} !important;
  }
  .order-paid-email .order-paid-total-row {
    background-color: ${mutedBg} !important;
    border-color: ${sunkenBorder} !important;
  }
  .order-paid-email .order-paid-total-label {
    color: ${theme.fg} !important;
    -webkit-text-fill-color: ${theme.fg} !important;
  }`;

  return `<style type="text/css">
:root {
  color-scheme: dark;
  supported-color-schemes: dark;
}
${rules}
@media only screen and (max-width: 600px) {
${rules}
}
@media (prefers-color-scheme: light) {
${rules}
}
@media (prefers-color-scheme: dark) {
${rules}
}
</style>`;
}

function orderCompletedEmailHero(theme: OrderPaidEmailTheme): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="text-align:center;margin-bottom:22px;">
    <tr>
      <td align="center" style="padding-bottom:16px;">
        <div style="width:56px;height:56px;line-height:56px;border-radius:50%;font-size:24px;font-weight:800;color:${theme.success};background:${theme.checkGradient};border:1px solid ${theme.successBorder};box-shadow:${theme.checkShadow};text-align:center;">✓</div>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom:10px;">
        <span class="order-complete-success" style="display:inline-block;padding:5px 14px;border-radius:999px;border:1px solid ${theme.successBorder};background:${theme.successBg};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:${theme.success};">Order complete</span>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding-bottom:4px;">
        <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:800;color:${theme.fg};letter-spacing:-0.02em;">Your order is complete!</h1>
      </td>
    </tr>
    <tr>
      <td style="padding-top:18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="height:1px;line-height:1px;font-size:0;background:linear-gradient(90deg,transparent,rgba(${theme.brandRgb},0.35),transparent);">&nbsp;</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function orderCompletedMessagePanel(
  theme: OrderPaidEmailTheme,
  messageHtml: string,
): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid ${theme.brandBorderSoft};border-radius:14px;background:linear-gradient(165deg,rgba(${theme.brandRgb},0.08) 0%,${theme.sunkenPanelBg} 72%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);">
    <tr>
      <td style="padding:16px 18px;font-size:15px;line-height:1.7;color:${theme.fg};">
        <span style="white-space:pre-line;">${messageHtml}</span>
      </td>
    </tr>
  </table>`;
}

export function orderCompletedEmail(
  settings: EffectiveEmailSettings,
  data: {
    name?: string;
    orderNumber: string;
    message?: string;
    orderUrl?: string;
  },
): EmailContent {
  const theme = resolveOrderPaidEmailTheme(settings);
  const textColor = '#ffffff';
  const textTheme: OrderPaidEmailTheme = {
    ...theme,
    fg: textColor,
    fgMuted: textColor,
  };
  const completionMessage =
    data.message?.trim() ||
    'Your order is complete. Your digital delivery is ready — open your order details for codes and instructions.';
  const orderDetailsUrl = data.orderUrl
    ? absoluteUrl(settings, data.orderUrl)
    : settings.webUrl;
  const messageHtml = escapeHtml(completionMessage).replace(/\n/g, '<br/>');

  const bodyHtml = `
    ${orderCompletedEmailHero(textTheme)}
    ${orderPaidDarkGreeting(textTheme, data.name)}
    <p style="margin:0 0 6px;font-size:15px;line-height:1.65;color:${textColor};">
      Great news! Your order
      <span class="order-complete-accent" style="display:inline-block;margin-left:6px;padding:3px 10px;border-radius:8px;border:1px solid ${theme.brandBorderSoft};background:${theme.brandBgSoft};font-size:14px;font-weight:800;color:${escapeHtml(theme.brand)};font-variant-numeric:tabular-nums;vertical-align:middle;">${escapeHtml(data.orderNumber)}</span>
      is now complete.
    </p>
    ${orderCompletedMessagePanel(textTheme, messageHtml)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-top:1px solid ${theme.sunkenPanelBorder};padding-top:22px;">
      <tr>
        <td align="center">
          ${data.orderUrl ? orderPaidPrimaryButton(theme, 'View order details', orderDetailsUrl) : ''}
        </td>
      </tr>
    </table>`;

  const text = [
    'Your order is complete!',
    '',
    `Hi ${data.name?.trim() || 'there'},`,
    '',
    `Great news! Your order ${data.orderNumber} is now complete.`,
    '',
    completionMessage,
    '',
    data.orderUrl ? `View order: ${orderDetailsUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const subject = `Your order ${data.orderNumber} is complete`;
  return {
    subject,
    html: renderOrderPaidLayout(settings, theme, {
      previewText: `Order ${data.orderNumber} is complete`,
      bodyHtml,
      layoutClass: 'order-complete-email',
      extraHeadHtml: orderCompletedMobileWhiteStyles(theme),
      footerTextColor: textColor,
    }),
    text,
  };
}

export function orderStatusUpdateEmail(
  settings: EffectiveEmailSettings,
  data: {
    name?: string;
    orderNumber: string;
    status: string;
    message?: string;
    orderUrl?: string;
  },
): EmailContent {
  const body = `
    ${greeting(data.name)}
    <p style="margin:0 0 14px;">There's an update on your order <strong>${escapeHtml(data.orderNumber)}</strong>.</p>
    ${infoBox(`<strong style="color:#0f172a;">Status:</strong> <span style="text-transform:capitalize;color:${escapeHtml(settings.primaryColor)};font-weight:700;">${escapeHtml(data.status)}</span>${data.message ? `<br/><span style="color:#374151;white-space:pre-line;">${escapeHtml(data.message).replace(/\n/g, '<br/>')}</span>` : ''}`)}
    ${data.orderUrl ? button(settings, 'View order details', absoluteUrl(settings, data.orderUrl)) : ''}`;
  return wrap(
    settings,
    `Order ${data.orderNumber}: ${data.status}`,
    'Order status updated',
    body,
    `Order ${data.orderNumber} is now ${data.status}. ${data.message ?? ''}`,
    `Update on order ${data.orderNumber}`,
  );
}

export function paymentSuccessEmail(
  settings: EffectiveEmailSettings,
  data: {
    name?: string;
    orderNumber?: string;
    amount: number;
    currency?: string;
    method?: string;
    orderUrl?: string;
  },
): EmailContent {
  const currency = data.currency ?? 'BDT';
  const body = `
    ${greeting(data.name)}
    <p style="margin:0 0 14px;">We've successfully received your payment${data.orderNumber ? ` for order <strong>${escapeHtml(data.orderNumber)}</strong>` : ''}.</p>
    ${infoBox(
      `<strong style="color:#0f172a;">Amount paid</strong><span style="float:right;font-weight:800;color:#0f172a;">${escapeHtml(formatMoney(data.amount, currency))}</span>` +
        (data.method
          ? `<br/><span style="color:#6b7280;">Method: ${escapeHtml(data.method)}</span>`
          : ''),
    )}
    ${data.orderUrl ? button(settings, 'View order', absoluteUrl(settings, data.orderUrl)) : ''}
    <p style="margin:0;color:#6b7280;">Thank you for your purchase!</p>`;
  return wrap(
    settings,
    `Payment received${data.orderNumber ? ` — ${data.orderNumber}` : ''}`,
    'Payment successful 🎉',
    body,
    `Payment of ${formatMoney(data.amount, currency)} received${data.orderNumber ? ` for ${data.orderNumber}` : ''}.`,
    'Your payment was successful',
  );
}

export function paymentFailedEmail(
  settings: EffectiveEmailSettings,
  data: {
    name?: string;
    orderNumber?: string;
    amount: number;
    currency?: string;
    reason?: string;
    retryUrl?: string;
  },
): EmailContent {
  const currency = data.currency ?? 'BDT';
  const body = `
    ${greeting(data.name)}
    <p style="margin:0 0 14px;">Unfortunately your payment${data.orderNumber ? ` for order <strong>${escapeHtml(data.orderNumber)}</strong>` : ''} could not be completed.</p>
    ${infoBox(
      `<strong style="color:#0f172a;">Amount</strong><span style="float:right;font-weight:800;color:#0f172a;">${escapeHtml(formatMoney(data.amount, currency))}</span>` +
        (data.reason
          ? `<br/><span style="color:#b91c1c;">Reason: ${escapeHtml(data.reason)}</span>`
          : ''),
    )}
    ${data.retryUrl ? button(settings, 'Retry payment', absoluteUrl(settings, data.retryUrl)) : ''}
    <p style="margin:0;color:#6b7280;">No money has been deducted. You can try again or use a different payment method.</p>`;
  return wrap(
    settings,
    `Payment failed${data.orderNumber ? ` — ${data.orderNumber}` : ''}`,
    'Payment failed',
    body,
    `Payment of ${formatMoney(data.amount, currency)} failed${data.reason ? `: ${data.reason}` : ''}.`,
    'There was a problem with your payment',
  );
}

/**
 * Storefront dark theme — mirrors apps/web globals.css [data-theme="dark"].
 * Brand accent comes from admin email primaryColor when set.
 */
interface OrderPaidEmailTheme {
  brand: string;
  brandRgb: string;
  brandBgSoft: string;
  brandBorderSoft: string;
  brandGlow: string;
  brandReceiptGradient: string;
  brandIconBg: string;
  brandIconBorder: string;
  btnPrimaryBg: string;
  btnPrimaryBorder: string;
  btnPrimaryShadow: string;
  bg: string;
  bgElevated: string;
  bgMuted: string;
  bgSunken: string;
  fg: string;
  fgMuted: string;
  border: string;
  borderStrong: string;
  sunkenPanelBg: string;
  sunkenPanelBorder: string;
  success: string;
  successBg: string;
  successBorder: string;
  successLine: string;
  checkGradient: string;
  checkShadow: string;
  pendingDot: string;
  accent: string;
  accentBg: string;
  accentBorder: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) {
    return null;
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function resolveOrderPaidEmailTheme(
  settings: EffectiveEmailSettings,
): OrderPaidEmailTheme {
  const brand = settings.primaryColor?.trim() || '#38bfb0';
  const rgb = hexToRgb(brand) ?? { r: 38, g: 191, b: 176 };
  const brandRgb = `${rgb.r},${rgb.g},${rgb.b}`;
  return {
    brand,
    brandRgb,
    brandBgSoft: `rgba(${brandRgb},0.08)`,
    brandBorderSoft: `rgba(${brandRgb},0.35)`,
    brandGlow: `rgba(${brandRgb},0.25)`,
    brandReceiptGradient: `linear-gradient(135deg,rgba(${brandRgb},0.1) 0%,rgba(${brandRgb},0.04) 100%)`,
    brandIconBg: `rgba(${brandRgb},0.12)`,
    brandIconBorder: `rgba(${brandRgb},0.32)`,
    btnPrimaryBg: `linear-gradient(165deg,rgba(${brandRgb},0.18) 0%,rgba(${brandRgb},0.08) 55%,rgba(${brandRgb},0.12) 100%)`,
    btnPrimaryBorder: `rgba(${brandRgb},0.42)`,
    btnPrimaryShadow: `0 0 0 1px rgba(${brandRgb},0.08),inset 0 1px 0 rgba(255,255,255,0.08),0 3px 10px rgba(${brandRgb},0.12)`,
    bg: '#011926',
    bgElevated: '#031a22',
    bgMuted: '#06212a',
    bgSunken: '#000f15',
    fg: '#f8fafc',
    fgMuted: '#94a3b8',
    border: '#0e2832',
    borderStrong: '#163c48',
    sunkenPanelBg: 'rgba(0,15,21,0.55)',
    sunkenPanelBorder: 'rgba(14,40,50,0.75)',
    success: '#10b981',
    successBg: 'rgba(16,185,129,0.12)',
    successBorder: 'rgba(16,185,129,0.38)',
    successLine: 'rgba(16,185,129,0.55)',
    checkGradient:
      'linear-gradient(145deg,rgba(16,185,129,0.2) 0%,rgba(16,185,129,0.08) 100%)',
    checkShadow:
      '0 0 0 6px rgba(16,185,129,0.08),0 12px 28px -8px rgba(16,185,129,0.35)',
    pendingDot: '#475569',
    accent: '#818cf8',
    accentBg: 'rgba(99,102,241,0.1)',
    accentBorder: 'rgba(99,102,241,0.32)',
  };
}

function formatPaymentMethodLabel(method?: string): string {
  switch ((method ?? '').toLowerCase()) {
    case 'wallet':
      return 'Wallet';
    case 'gateway':
      return 'Mobile banking (MFS)';
    case 'manual':
      return 'Manual payment';
    default:
      return method?.trim() || '—';
  }
}

/** Dark card layout — storefront thank-you page (.order-thank-you-card). */
function renderOrderPaidLayout(
  settings: EffectiveEmailSettings,
  theme: OrderPaidEmailTheme,
  opts: {
    previewText: string;
    bodyHtml: string;
    layoutClass?: string;
    extraHeadHtml?: string;
    footerTextColor?: string;
  },
): string {
  const logo = settings.logoUrl
    ? emailLogoTag(settings, settings.logoUrl, settings.fromName)
    : `<span style="font-size:22px;font-weight:800;color:${escapeHtml(theme.brand)};letter-spacing:-0.02em;">${escapeHtml(settings.fromName)}</span>`;
  const cardStyle = [
    `background:linear-gradient(165deg,${theme.bgElevated} 0%,${theme.bgSunken} 88%)`,
    `border:1px solid rgba(${theme.brandRgb},0.12)`,
    'border-radius:16px',
    'padding:24px 20px 22px',
    `box-shadow:0 0 0 1px rgba(${theme.brandRgb},0.06),0 24px 48px -20px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.06)`,
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  ].join(';');
  const topShine = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td style="height:1px;line-height:1px;font-size:0;background:linear-gradient(90deg,transparent,rgba(${theme.brandRgb},0.45),transparent);">&nbsp;</td></tr></table>`;
  const footerColor = opts.footerTextColor ?? theme.fgMuted;
  const bodyContent = opts.layoutClass
    ? `<div class="${opts.layoutClass}">${opts.bodyHtml}</div>`
    : opts.bodyHtml;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${escapeHtml(opts.previewText)}</title>
  ${orderReceiptShellColorLockStyles(theme)}${opts.extraHeadHtml ?? ''}
</head>
<body class="order-receipt-email-body" bgcolor="${theme.bg}" style="margin:0;padding:0;background-color:${theme.bg};background-image:none;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.previewText)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${theme.bg}" class="order-receipt-email-shell" style="background-color:${theme.bg};background-image:none;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
          <tr>
            <td align="center" bgcolor="${theme.bg}" class="order-receipt-email-logo" style="padding:0 0 24px;background-color:${theme.bg};background-image:none;">${logo}</td>
          </tr>
          <tr>
            <td bgcolor="${theme.bgElevated}" class="order-receipt-email-card" style="${cardStyle}">
              ${topShine}
              ${bodyContent}
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="${theme.bg}" class="order-receipt-email-footer ${opts.layoutClass ? `${opts.layoutClass}-footer` : ''}" style="padding:24px 8px 0;font-size:12px;line-height:1.65;color:${footerColor};background-color:${theme.bg};background-image:none;">
              ${escapeHtml(settings.footerText)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function orderPaidReceiptIcon(theme: OrderPaidEmailTheme): string {
  const stroke = escapeHtml(theme.brand);
  const svg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;">
    <path d="M5 3v18l2-1.2L9 21l2-1.2L13 21l2-1.2L17 21l2-1.2V3l-2 1.2L15 3l-2 1.2L11 3 9 4.2 7 3 5 4.2Z" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>`;

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:32px;height:32px;border-radius:8px;border:1px solid ${theme.brandIconBorder};background:linear-gradient(145deg,rgba(${theme.brandRgb},0.2) 0%,rgba(${theme.brandRgb},0.09) 55%,rgba(${theme.brandRgb},0.04) 100%);box-shadow:0 0 0 2px rgba(${theme.brandRgb},0.06),0 4px 10px -5px rgba(${theme.brandRgb},0.3),inset 0 1px 0 rgba(255,255,255,0.12);">
    <tr>
      <td align="center" valign="middle" style="width:32px;height:32px;padding:1px 2px;line-height:0;">${svg}</td>
    </tr>
  </table>`;
}

function orderPaidReceiptCard(theme: OrderPaidEmailTheme, orderNumber: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${theme.brandBorderSoft};border-radius:12px;background:${theme.brandReceiptGradient};">
    <tr>
      <td style="padding:10px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:middle;padding-right:10px;">${orderPaidReceiptIcon(theme)}</td>
            <td style="vertical-align:middle;">
              <div style="font-size:14px;line-height:1.4;color:${theme.fgMuted};">
                <span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Order number</span>
                <span style="margin-left:8px;font-size:20px;font-weight:800;color:${escapeHtml(theme.brand)};font-variant-numeric:tabular-nums;">#${escapeHtml(orderNumber)}</span>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function orderPaidDetailGrid(
  theme: OrderPaidEmailTheme,
  rows: Array<{ label: string; value: string }>,
): string {
  const cell = (row: { label: string; value: string }) =>
    `<td width="50%" valign="top" style="padding:5px 6px 5px 0;font-size:13px;line-height:1.55;">
      <span class="order-paid-detail-label order-paid-fg-muted" style="display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${theme.fgMuted};margin-bottom:4px;">${escapeHtml(row.label)}</span>
      <span class="order-paid-detail-value order-paid-fg" style="color:${theme.fg};font-weight:600;">${escapeHtml(row.value)}</span>
    </td>`;

  const tableRows: string[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    const left = rows[i];
    const right = rows[i + 1];
    tableRows.push(
      `<tr>${left ? cell(left) : '<td width="50%"></td>'}${right ? cell(right) : '<td width="50%"></td>'}</tr>`,
    );
  }

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${theme.bgSunken}" class="order-paid-panel order-paid-detail-grid" style="border:1px solid ${theme.sunkenPanelBorder};border-radius:12px;background:${theme.bgSunken};padding:6px 10px;">${tableRows.join('')}</table>`;
}

function orderPaidFieldUsesSecretStyle(label: string): boolean {
  return /password|pass|পাস/i.test(label);
}

function orderPaidFieldMarker(
  theme: OrderPaidEmailTheme,
  secret: boolean,
): string {
  const label = secret ? 'PWD' : 'ID';
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:16px;height:16px;border-radius:4px;border:1px solid ${theme.brandBorderSoft};background:${theme.brandBgSoft};">
    <tr>
      <td align="center" valign="middle" style="width:16px;height:16px;font-size:8px;font-weight:800;line-height:1;color:${escapeHtml(theme.brand)};">${label}</td>
    </tr>
  </table>`;
}

function orderPaidItemHeader(
  settings: EffectiveEmailSettings,
  theme: OrderPaidEmailTheme,
  productTitle: string,
  imageUrl?: string,
): string {
  const thumbSrc = imageUrl?.trim();

  const thumbCell = thumbSrc
    ? `<td style="vertical-align:middle;padding-right:12px;width:52px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:48px;height:48px;border-radius:10px;border:1px solid ${theme.brandBorderSoft};background:rgba(0,0,0,0.2);">
          <tr>
            <td width="48" height="48" align="center" valign="middle" style="width:48px;height:48px;padding:0;line-height:0;">
              ${emailImageTag(settings, thumbSrc, { width: 48, height: 48 })}
            </td>
          </tr>
        </table>
      </td>`
    : `<td style="vertical-align:middle;padding-right:12px;width:52px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:48px;height:48px;border-radius:10px;border:1px solid ${theme.brandBorderSoft};background:rgba(255,255,255,0.04);">
          <tr>
            <td width="48" height="48" align="center" valign="middle" style="width:48px;height:48px;font-size:10px;font-weight:800;color:${theme.fgMuted};">IMG</td>
          </tr>
        </table>
      </td>`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      ${thumbCell}
      <td style="vertical-align:middle;">
        <div class="order-paid-item-title order-paid-fg" style="font-size:13px;font-weight:800;color:${theme.fg};letter-spacing:-0.01em;line-height:1.35;">${escapeHtml(productTitle)}</div>
      </td>
    </tr>
  </table>`;
}

function orderPaidCheckoutItemCard(
  item: EmailOrderItem,
  currency: string,
  theme: OrderPaidEmailTheme,
  settings: EffectiveEmailSettings,
): string {
  const { productTitle, packageName } = parseOrderLineTitle(item.title);
  const lineTotal = item.unitPrice * item.quantity;
  const customerInputs = item.customerInputs ?? [];
  const showFieldsPanel = Boolean(packageName || customerInputs.length > 0);

  const packageBadge = packageName
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;border:1px solid ${theme.brandBorderSoft};background:${theme.brandBgSoft};">
        <tr>
          <td style="padding:8px 10px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;font-size:12px;font-weight:700;color:${escapeHtml(theme.brand)};">
                  ${escapeHtml(packageName)}
                  ${item.quantity > 1 ? `<span style="color:${theme.fgMuted};font-weight:600;"> × ${escapeHtml(item.quantity)}</span>` : ''}
                </td>
                <td align="right" style="vertical-align:middle;font-size:12px;font-weight:700;color:${escapeHtml(theme.brand)};white-space:nowrap;font-variant-numeric:tabular-nums;">
                  ${escapeHtml(formatMoney(item.unitPrice, currency))}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`
    : '';

  const customerFields = customerInputs
    .map((input) => {
      const secret = orderPaidFieldUsesSecretStyle(input.label);
      const valueStyle = secret ? 'letter-spacing:0.08em;' : '';
      return `
      <div style="margin-top:6px;padding:6px 8px;border-radius:8px;border:1px solid ${theme.border};background:rgba(255,255,255,0.04);">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:top;padding-right:6px;line-height:0;">${orderPaidFieldMarker(theme, secret)}</td>
            <td class="order-paid-fg-muted" style="font-size:11px;line-height:1.55;color:${theme.fgMuted};">${escapeHtml(input.label)}</td>
          </tr>
        </table>
        <div class="order-paid-fg" style="margin-top:4px;padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.22);font-size:12px;font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:${theme.fg};word-break:break-all;${valueStyle}">
          ${escapeHtml(input.value)}
        </div>
      </div>`;
    })
    .join('');

  const fieldsPanel = showFieldsPanel
    ? `
    <div style="margin-top:8px;padding:8px;border-radius:10px;border:1px solid ${theme.sunkenPanelBorder};background:linear-gradient(180deg,rgba(255,255,255,0.04) 0%,rgba(0,0,0,0.16) 100%);">
      ${packageBadge}
      ${customerFields}
    </div>`
    : '';

  const amountRow = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-radius:10px;border:1px solid ${theme.border};background:linear-gradient(95deg,rgba(255,255,255,0.03) 0%,rgba(0,0,0,0.14) 100%);">
    <tr>
      <td style="padding:8px 10px;vertical-align:middle;">
        <span class="order-paid-fg-muted" style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${theme.fgMuted};">Amount</span>
      </td>
      <td align="right" style="padding:8px 10px;vertical-align:middle;">
        <span style="display:inline-block;padding:5px 12px;border-radius:8px;border:1px solid ${theme.brandBorderSoft};background:${theme.brandBgSoft};font-size:17px;font-weight:800;color:${escapeHtml(theme.brand)};font-variant-numeric:tabular-nums;line-height:1;">
          ${escapeHtml(formatMoney(lineTotal, currency))}
        </span>
      </td>
    </tr>
  </table>`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${theme.bgSunken}" class="order-paid-panel order-paid-item-card" style="margin-bottom:10px;border-radius:14px;border:1px solid ${theme.brandBorderSoft};background:${theme.bgSunken};box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);">
    <tr>
      <td style="padding:10px 12px;">
        ${orderPaidItemHeader(settings, theme, productTitle, item.imageUrl)}
        ${fieldsPanel}
        ${amountRow}
      </td>
    </tr>
  </table>`;
}

function orderPaidItemsTable(
  items: EmailOrderItem[],
  currency: string,
  total: number,
  theme: OrderPaidEmailTheme,
  settings: EffectiveEmailSettings,
): string {
  if (!items?.length) {
    return `<p style="margin:0;color:${theme.fgMuted};font-size:13px;">No items listed</p>`;
  }

  const cards = items
    .map((it) => orderPaidCheckoutItemCard(it, currency, theme, settings))
    .join('');

  const orderTotalRow =
    items.length > 1
      ? `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${theme.bgMuted}" class="order-paid-panel order-paid-total-row" style="margin-top:2px;border-radius:10px;border:1px solid ${theme.border};background:${theme.bgMuted};">
    <tr>
      <td class="order-paid-total-label order-paid-fg" style="padding:10px 12px;font-size:15px;font-weight:800;color:${theme.fg};">Total paid</td>
      <td align="right" class="order-paid-brand" style="padding:10px 12px;font-size:18px;font-weight:800;color:${escapeHtml(theme.brand)};font-variant-numeric:tabular-nums;">
        ${escapeHtml(formatMoney(total, currency))}
      </td>
    </tr>
  </table>`
      : '';

  return `<div class="order-paid-items-summary">${cards}${orderTotalRow}</div>`;
}

function orderPaidProgressTracker(theme: OrderPaidEmailTheme): string {
  const dot = (color: string, ring?: string) =>
    `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};${ring ? `box-shadow:0 0 0 4px ${ring};` : ''}"></span>`;
  const line = (from: string, to: string) =>
    `<td style="width:12%;vertical-align:top;padding-top:5px;"><div style="height:2px;background:linear-gradient(90deg,${from},${to});"></div></td>`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="28%" align="center" style="font-size:11px;line-height:1.45;color:${theme.success};padding:4px 2px;">
        ${dot(theme.success)}<br/><span style="display:block;margin-top:8px;font-weight:600;">Payment received</span>
      </td>
      ${line(theme.successLine, theme.border)}
      <td width="28%" align="center" style="font-size:11px;line-height:1.45;color:${escapeHtml(theme.brand)};padding:4px 2px;">
        ${dot(escapeHtml(theme.brand), theme.brandGlow)}<br/><span style="display:block;margin-top:8px;font-weight:700;">Preparing delivery</span>
      </td>
      ${line(theme.border, theme.pendingDot)}
      <td width="28%" align="center" style="font-size:11px;line-height:1.45;color:${theme.fgMuted};padding:4px 2px;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;border:2px solid ${theme.pendingDot};box-sizing:border-box;"></span><br/><span style="display:block;margin-top:8px;">Codes sent by email</span>
      </td>
    </tr>
  </table>`;
}

function orderPaidPrimaryButton(
  theme: OrderPaidEmailTheme,
  label: string,
  url: string,
): string {
  return `
  <a href="${escapeHtml(url)}" target="_blank"
     style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:${escapeHtml(theme.brand)};text-decoration:none;border-radius:10px;border:1px solid ${theme.btnPrimaryBorder};background:${theme.btnPrimaryBg};box-shadow:${theme.btnPrimaryShadow};">
    ${escapeHtml(label)}
  </a>`;
}

function orderPaidSecondaryButton(
  theme: OrderPaidEmailTheme,
  label: string,
  url: string,
): string {
  return `
  <a href="${escapeHtml(url)}" target="_blank"
     style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:${theme.fgMuted};text-decoration:none;border-radius:10px;border:1px solid ${theme.sunkenPanelBorder};background:${theme.sunkenPanelBg};">
    ${escapeHtml(label)}
  </a>`;
}

function orderPaidSectionShell(
  theme: OrderPaidEmailTheme,
  title: string,
  innerHtml: string,
): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="order-paid-section" style="margin-bottom:14px;">
    <tr>
      <td class="order-paid-section-title order-paid-fg-muted" style="padding-bottom:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${theme.fgMuted};">${escapeHtml(title)}</td>
    </tr>
    <tr>
      <td>${innerHtml}</td>
    </tr>
  </table>`;
}

/** Paid-order receipt — matches storefront thank-you page (payment confirmed). */
export function orderPaidConfirmationEmail(
  settings: EffectiveEmailSettings,
  data: {
    name?: string;
    orderNumber: string;
    items?: EmailOrderItem[];
    total?: number;
    currency?: string;
    customerEmail?: string;
    customerMobile?: string;
    paymentMethod?: string;
    paymentTrxId?: string;
    orderUrl?: string;
  },
): EmailContent {
  const theme = resolveOrderPaidEmailTheme(settings);
  const currency = data.currency ?? 'BDT';
  const total = data.total ?? 0;
  const items = data.items ?? [];
  const customerEmailDisplay = data.customerEmail?.trim() || '—';
  const supportUrl = absoluteUrl(settings, '/support');
  const productsUrl = absoluteUrl(settings, '/products');
  const loginUrl = absoluteUrl(settings, '/login');
  const orderUrl = data.orderUrl
    ? absoluteUrl(settings, data.orderUrl)
    : settings.webUrl;
  const customerName = data.name?.trim() || '—';
  const paymentLabel = formatPaymentMethodLabel(data.paymentMethod);
  const paymentTrxId = data.paymentTrxId?.trim() || '—';

  const bodyHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="text-align:center;">
      <tr>
        <td align="center" style="padding-bottom:18px;">
          <div style="width:60px;height:60px;line-height:60px;border-radius:50%;font-size:26px;font-weight:800;color:${theme.success};background:${theme.checkGradient};border:1px solid ${theme.successBorder};box-shadow:${theme.checkShadow};text-align:center;">✓</div>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:10px;">
          <span style="display:inline-block;padding:5px 14px;border-radius:999px;border:1px solid ${theme.successBorder};background:${theme.successBg};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${theme.success};">Payment confirmed</span>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:8px;">
          <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:800;color:${theme.fg};letter-spacing:-0.02em;">Thank you for your order!</h1>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:28px;font-size:15px;line-height:1.65;color:${theme.fgMuted};max-width:480px;">
          Your payment was received successfully. We&apos;re preparing your digital delivery now.
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
      <tr><td>${orderPaidReceiptCard(theme, data.orderNumber)}</td></tr>
    </table>

    ${orderPaidSectionShell(theme, 'Order summary', orderPaidItemsTable(items, currency, total, theme, settings))}

    ${orderPaidSectionShell(
      theme,
      'Customer information',
      orderPaidDetailGrid(theme, [
        { label: 'Name', value: customerName },
        { label: 'Email', value: customerEmailDisplay },
        { label: 'Payment method', value: paymentLabel },
        { label: 'Trx ID', value: paymentTrxId },
      ]),
    )}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr><td>${orderPaidProgressTracker(theme)}</td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${theme.sunkenPanelBorder};padding-top:20px;margin-top:2px;">
      <tr>
        <td align="center" style="padding-bottom:14px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:4px 6px;">${orderPaidPrimaryButton(theme, 'Continue shopping →', productsUrl)}</td>
              <td style="padding:4px 6px;">${orderPaidSecondaryButton(theme, 'Sign in to track orders', loginUrl)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  const itemLines = items
    .map((it) => {
      const inputLines = (it.customerInputs ?? [])
        .map((input) => `  ${input.label}: ${input.value}`)
        .join('\n');
      const base = `${it.title} ×${it.quantity} — ${formatMoney(it.unitPrice * it.quantity, currency)}`;
      return inputLines ? `${base}\n${inputLines}` : base;
    })
    .join('\n');

  const text = [
    'Payment confirmed — Thank you for your order!',
    '',
    `Order #${data.orderNumber}`,
    `Customer: ${customerName}`,
    `Email: ${customerEmailDisplay}`,
    `Payment: ${paymentLabel}`,
    `Trx ID: ${paymentTrxId}`,
    '',
    itemLines || 'No items listed',
    `Total: ${formatMoney(total, currency)}`,
    '',
    `Track order: ${orderUrl}`,
    `Support: ${supportUrl}`,
  ].join('\n');

  const subject = `Payment confirmed — order #${data.orderNumber}`;
  return {
    subject,
    html: renderOrderPaidLayout(settings, theme, {
      previewText: `Payment received for order ${data.orderNumber}`,
      bodyHtml,
      layoutClass: 'order-paid-email',
      extraHeadHtml: orderPaidEmailColorLockStyles(theme),
    }),
    text,
  };
}

export function contactFormEmail(
  settings: EffectiveEmailSettings,
  data: { fromName: string; fromEmail: string; subject: string; message: string },
): EmailContent {
  const body = `
    <p style="margin:0 0 14px;">You've received a new message from the contact form.</p>
    ${infoBox(
      `<strong style="color:#0f172a;">From:</strong> ${escapeHtml(data.fromName)} &lt;${escapeHtml(data.fromEmail)}&gt;<br/>
       <strong style="color:#0f172a;">Subject:</strong> ${escapeHtml(data.subject)}`,
    )}
    <p style="margin:0 0 6px;font-weight:700;color:#0f172a;">Message</p>
    <p style="margin:0;white-space:pre-wrap;color:#374151;">${escapeHtml(data.message)}</p>`;
  return wrap(
    settings,
    `Contact form: ${data.subject}`,
    'New contact message',
    body,
    `From ${data.fromName} <${data.fromEmail}>\nSubject: ${data.subject}\n\n${data.message}`,
    `New message from ${data.fromName}`,
  );
}

export function adminNewOrderEmail(
  settings: EffectiveEmailSettings,
  data: {
    orderNumber: string;
    customerName?: string;
    customerEmail?: string;
    items?: EmailOrderItem[];
    total: number;
    currency?: string;
    orderUrl?: string;
  },
): EmailContent {
  const currency = data.currency ?? 'BDT';
  const body = `
    <p style="margin:0 0 14px;">A new order has been placed.</p>
    ${infoBox(
      `<strong style="color:#0f172a;">Order:</strong> ${escapeHtml(data.orderNumber)}<br/>
       <strong style="color:#0f172a;">Customer:</strong> ${escapeHtml(data.customerName || '—')}${data.customerEmail ? ` &lt;${escapeHtml(data.customerEmail)}&gt;` : ''}`,
    )}
    ${itemsTable(data.items ?? [], currency)}
    ${infoBox(`<strong style="color:#0f172a;">Total</strong><span style="float:right;font-weight:800;color:#0f172a;">${escapeHtml(formatMoney(data.total, currency))}</span>`)}
    ${data.orderUrl ? button(settings, 'Open in admin', absoluteUrl(settings, data.orderUrl)) : ''}`;
  return wrap(
    settings,
    `New order ${data.orderNumber} — ${formatMoney(data.total, currency)}`,
    'New order received 🛒',
    body,
    `New order ${data.orderNumber} from ${data.customerName ?? 'customer'}. Total: ${formatMoney(data.total, currency)}.`,
    `New order ${data.orderNumber}`,
  );
}

/** Generic fallback used by the notification channel for any event. */
export function genericEmail(
  settings: EffectiveEmailSettings,
  data: { title: string; body: string; ctaLabel?: string; ctaUrl?: string },
): EmailContent {
  const paragraphs = data.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p)}</p>`)
    .join('');
  const cta =
    data.ctaLabel && data.ctaUrl
      ? button(settings, data.ctaLabel, absoluteUrl(settings, data.ctaUrl))
      : '';
  return wrap(
    settings,
    data.title,
    data.title,
    `${paragraphs}${cta}`,
    `${data.title}\n\n${data.body}`,
    data.title,
  );
}
