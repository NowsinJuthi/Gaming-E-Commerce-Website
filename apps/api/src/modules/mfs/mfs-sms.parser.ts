import { MfsProvider } from '../../common/enums';
import { DEFAULT_MFS_SMS_FORMATS } from './mfs-sms-format.defaults';
import type { MfsSmsProviderFormatConfig } from './mfs-sms-format.types';

export type ParsedSmsPayload = {
  sender: string;
  body: string;
  trxId?: string;
  amount?: number;
};

const ALLOWED_SENDERS = ['bkash', 'nagad', 'rocket', '16216', 'upay'];

function parsePositiveAmount(value: number | null | undefined): number | undefined {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return undefined;
  }
  const n = Number(value);
  return n > 0 ? n : undefined;
}

function safeRegexTest(pattern: string, text: string): boolean {
  try {
    return new RegExp(pattern, 'i').test(text);
  } catch {
    return false;
  }
}

function matchFirstCapture(
  patterns: string[],
  body: string,
): string | undefined {
  for (const pattern of patterns) {
    try {
      const match = body.match(new RegExp(pattern, 'i'));
      if (match?.[1]) return match[1];
    } catch {
      /* skip invalid pattern */
    }
  }
  return undefined;
}

function parseAmount(patterns: string[], body: string): number | undefined {
  const raw = matchFirstCapture(patterns, body);
  if (!raw) return undefined;
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function findFormat(
  formats: MfsSmsProviderFormatConfig[],
  providerHint: string,
): MfsSmsProviderFormatConfig | undefined {
  const hint = providerHint.toLowerCase();
  return formats.find((fmt) => hint.includes(fmt.provider));
}

function parseWithFormat(
  body: string,
  format: MfsSmsProviderFormatConfig,
): { trxId?: string; amount?: number } {
  const trxId = matchFirstCapture(format.trxIdPatterns, body);
  const amount = parseAmount(format.amountPatterns, body);
  return { trxId, amount };
}

export function inferSmsSenderWithFormats(
  sender: string,
  body: string,
  formats: MfsSmsProviderFormatConfig[],
): string {
  const normalized = sender.trim().toLowerCase();
  const text = body.trim();
  const lower = text.toLowerCase();

  const sorted = [...formats]
    .filter((fmt) => fmt.enabled)
    .sort((a, b) => a.priority - b.priority);

  // Phase 1: exact sender-name match (e.g. sender field = "bKash", "Nagad").
  // This is the most reliable signal — skip body analysis entirely.
  for (const fmt of sorted) {
    if (normalized && normalized.includes(fmt.provider)) {
      return fmt.provider;
    }
  }

  // Phase 2: keyword match against the SMS body (provider-unique keywords only).
  for (const fmt of sorted) {
    if (
      fmt.detectKeywords.some(
        (keyword) => keyword && lower.includes(keyword.toLowerCase()),
      )
    ) {
      return fmt.provider;
    }
  }

  // Phase 3: pattern match against the SMS body.
  // detectPatterns MUST be unique per-provider (see defaults) to avoid
  // cross-contamination (e.g. bKash TrxID being matched by Rocket pattern).
  for (const fmt of sorted) {
    if (fmt.detectPatterns.some((pattern) => safeRegexTest(pattern, text))) {
      return fmt.provider;
    }
  }

  // Phase 4: fall back to the raw sender string if it's a known sender.
  if (normalized && ALLOWED_SENDERS.some((allowed) => normalized.includes(allowed))) {
    return normalized;
  }

  return normalized;
}

export function isAllowedSmsSenderWithFormats(
  sender: string,
  body: string,
  formats: MfsSmsProviderFormatConfig[],
): boolean {
  const normalized = inferSmsSenderWithFormats(sender, body, formats);
  return ALLOWED_SENDERS.some((allowed) => normalized.includes(allowed));
}

export function parseSmsFieldsWithFormats(
  sender: string,
  body: string,
  trxId: string | null | undefined,
  amount: number | null | undefined,
  formats: MfsSmsProviderFormatConfig[],
): { trxId?: string; amount?: number } {
  let parsedTrxId = trxId?.trim() || undefined;
  let parsedAmount = parsePositiveAmount(
    amount !== null && amount !== undefined ? Number(amount) : undefined,
  );

  const providerHint = inferSmsSenderWithFormats(sender, body, formats);
  const primary = findFormat(formats, providerHint);

  if (primary && (!parsedTrxId || parsedAmount === undefined)) {
    const fromBody = parseWithFormat(body, primary);
    if (!parsedTrxId && fromBody.trxId) parsedTrxId = fromBody.trxId;
    if (parsedAmount === undefined && fromBody.amount !== undefined) {
      parsedAmount = fromBody.amount;
    }
  }

  if (!parsedTrxId || parsedAmount === undefined) {
    for (const fmt of formats.filter((row) => row.enabled)) {
      if (primary && fmt.provider === primary.provider) continue;
      const alt = parseWithFormat(body, fmt);
      if (!parsedTrxId && alt.trxId) parsedTrxId = alt.trxId;
      if (parsedAmount === undefined && alt.amount !== undefined) {
        parsedAmount = alt.amount;
      }
      if (parsedTrxId && parsedAmount !== undefined) break;
    }
  }

  return {
    trxId: parsedTrxId?.toUpperCase(),
    amount: parsedAmount,
  };
}

/** Backward-compatible helpers using built-in defaults. */
export function inferSmsSender(sender: string, body: string): string {
  return inferSmsSenderWithFormats(sender, body, DEFAULT_MFS_SMS_FORMATS);
}

export function isAllowedSmsSender(sender: string, body = ''): boolean {
  return isAllowedSmsSenderWithFormats(sender, body, DEFAULT_MFS_SMS_FORMATS);
}

export function parseSmsFields(
  sender: string,
  body: string,
  trxId?: string | null,
  amount?: number | null,
): { trxId?: string; amount?: number } {
  return parseSmsFieldsWithFormats(
    sender,
    body,
    trxId,
    amount,
    DEFAULT_MFS_SMS_FORMATS,
  );
}

/** Customer wallet number parsed from MFS receive SMS body (e.g. Nagad Sender:, bKash from). */
export function parseMfsCustomerMobileFromSmsBody(body: string): string | undefined {
  const text = body.replace(/\r/g, '');
  const patterns = [
    /Sender:\s*(01[3-9]\d{8})/i,
    /from\s+(01[3-9]\d{8})/i,
    /from\s+(\d{11,14})/i,
    /(?:^|\s)(01[3-9]\d{8})(?:\s|$|\.)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const mobile = match?.[1]?.trim();
    if (mobile) return mobile;
  }

  return undefined;
}

/** Maximum characters kept per SMS body and sender to prevent ReDoS / memory abuse. */
const MAX_SMS_BODY_LEN = 1_000;
const MAX_SMS_SENDER_LEN = 64;
const MAX_PAYLOADS_PER_REQUEST = 50;

const clampBody = (s: string): string => s.slice(0, MAX_SMS_BODY_LEN);
const clampSender = (s: string): string => s.slice(0, MAX_SMS_SENDER_LEN);

/** Walk nested JSON from the SMS forwarding app. */
export function flattenSmsPayloads(raw: unknown): ParsedSmsPayload[] {
  const payloads: ParsedSmsPayload[] = [];
  const queue: unknown[] = [raw];

  while (queue.length > 0) {
    if (payloads.length >= MAX_PAYLOADS_PER_REQUEST) break;

    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;

    const record = current as Record<string, unknown>;
    const hasSmsShape =
      'payment_method' in record ||
      'transaction_id' in record ||
      'address' in record ||
      'sender' in record ||
      'body' in record;

    if (hasSmsShape) {
      const body = clampBody(
        String(
          record.message ??
            record.body ??
            record.content ??
            record.text ??
            JSON.stringify(record),
        ),
      );
      const rawSender = clampSender(
        String(
          record.mobile_number ??
            record.address ??
            record.sender ??
            record.number ??
            record.payment_method ??
            '',
        ),
      );
      const sender = inferSmsSender(rawSender, body);
      const trxIdRaw =
        (record.transaction_id as string | undefined) ??
        (record.trx_id as string | undefined);
      const trxId = trxIdRaw ? String(trxIdRaw).slice(0, 64) : undefined;
      const amountRaw = record.amount;
      const amount =
        amountRaw !== undefined && amountRaw !== null
          ? Number(amountRaw)
          : undefined;

      payloads.push({
        sender,
        body,
        trxId,
        amount: Number.isFinite(amount) ? amount : undefined,
      });
    } else {
      for (const child of Object.values(record)) {
        if (child && typeof child === 'object') queue.push(child);
      }
    }
  }

  if (payloads.length === 0 && raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const body = clampBody(
      String(
        record.body ?? record.message ?? record.content ?? JSON.stringify(raw),
      ),
    );
    const rawSender = clampSender(
      String(record.sender ?? record.address ?? ''),
    );
    payloads.push({
      sender: inferSmsSender(rawSender, body),
      body,
    });
  }

  return payloads;
}

export const MFS_PROVIDER_LABELS: Record<MfsProvider, string> = {
  [MfsProvider.Bkash]: 'bKash',
  [MfsProvider.Nagad]: 'Nagad',
  [MfsProvider.Rocket]: 'Rocket',
  [MfsProvider.Upay]: 'Upay',
};

export const MFS_PROVIDER_INSTRUCTIONS: Record<MfsProvider, string> = {
  [MfsProvider.Bkash]:
    'Open bKash app → Send Money → enter the number above → send exact amount → copy TrxID.',
  [MfsProvider.Nagad]:
    'Open Nagad app → Send Money → enter the number above → send exact amount → copy TxnID.',
  [MfsProvider.Rocket]:
    'Open Rocket app → Send Money → enter the number above → send exact amount → copy TrxID.',
  [MfsProvider.Upay]:
    'Open Upay app → Send Money → enter the number above → send exact amount → copy TrxID.',
};
