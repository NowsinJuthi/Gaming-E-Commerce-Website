import { MfsProvider } from '../../common/enums';
import type { MfsSmsProviderFormatConfig } from './mfs-sms-format.types';

/**
 * Built-in SMS patterns — used until admin saves custom formats.
 *
 * DETECTION RULES (critical — no cross-contamination allowed):
 *  • detectKeywords  → checked against the SMS BODY (lowercase).
 *                      Must be unique to that provider.
 *  • detectPatterns  → regex fallback only when keywords miss.
 *                      Must NEVER match another provider's SMS.
 *
 * Provider TrxID formats:
 *  • Rocket  → TxnId:XXXXXXXXXX   (numeric, e.g. 6655748269)
 *  • Nagad   → TxnID: XXXXXXXX    (short alphanumeric, e.g. 75G43MGD)
 *  • bKash   → TrxID XXXXXXXXXX   (10-char alphanumeric, e.g. DEI4C6XD3M)
 *  • Upay    → TrxID / TxnID      (varies)
 */
export const DEFAULT_MFS_SMS_FORMATS: MfsSmsProviderFormatConfig[] = [
  // ── Rocket (Dutch-Bangla Bank) ────────────────────────────────────────────
  // Unique markers: "A/C:" (masked account), "16216" short-code, "nexuspay" link.
  // Uses TxnId (numeric). Does NOT use TrxID (that is bKash).
  {
    provider: MfsProvider.Rocket,
    enabled: true,
    priority: 1,
    detectKeywords: ['rocket', '16216', 'a/c:'],
    // Fallback patterns that are 100% unique to Rocket SMS:
    //   • "a/c:***"  → masked account number present in every Rocket SMS
    //   • "nexuspay" → Rocket's download link domain
    detectPatterns: ['a\\/c:\\*', 'nexuspay'],
    // Rocket uses TxnId (numeric). Pattern is intentionally strict (digits only)
    // so it never grabs bKash's alphanumeric TrxID.
    trxIdPatterns: [
      'TxnId\\s*[:.]?\\s*(\\d+)',
      'TxnID\\s*[:.]?\\s*(\\d+)',
    ],
    amountPatterns: [
      'Tk\\s*([\\d,.]+)\\s*received',
      'Tk\\s*([\\d,.]+)',
    ],
    sampleSms:
      'Tk10.00 received from A/C:***396 Fee:Tk0, Your A/C Balance: Tk57.30 TxnId:6655748269 Date:21-JUN-26 12:11:23 am. Download https://bit.ly/nexuspay',
  },

  // ── Nagad ─────────────────────────────────────────────────────────────────
  // Unique markers: "nagad", "money received" (Nagad-specific opening line),
  //                 "ref: n/a", "sender:" label (Nagad shows this explicitly).
  // Uses TxnID (short alphanumeric, usually 8 chars).
  {
    provider: MfsProvider.Nagad,
    enabled: true,
    priority: 2,
    detectKeywords: ['nagad', 'money received'],
    // Fallback patterns unique to Nagad:
    //   • "ref: n/a" line appears in every Nagad receive SMS
    //   • "sender:\s*01" — Nagad explicitly labels the sender's number
    detectPatterns: ['ref:\\s*n\\/a', 'sender:\\s*01'],
    trxIdPatterns: [
      'TxnID\\s*[:\\s]\\s*([A-Za-z0-9]+)',
      'TxnId\\s*[:\\s]\\s*([A-Za-z0-9]+)',
      'Txn\\s*ID\\s*[:\\s]\\s*([A-Za-z0-9]+)',
    ],
    amountPatterns: [
      'Amount:\\s*Tk\\s*([\\d,.]+)',
      'Money\\s+Received[.\\s]*\\n?\\s*Amount:\\s*Tk\\s*([\\d,.]+)',
      'Money\\s+Received[:\\s]+Tk\\s*([\\d,.]+)',
    ],
    sampleSms: `Money Received.
Amount: Tk 1799.00
Sender: 01908012662
Ref: N/A
TxnID: 75G43MGD
Balance: Tk 3821.31`,
  },

  // ── bKash ─────────────────────────────────────────────────────────────────
  // Unique markers: "bkash" (always present in SMS body or sender).
  // Uses TrxID (10-char alphanumeric, e.g. DEI4C6XD3M).
  {
    provider: MfsProvider.Bkash,
    enabled: true,
    priority: 3,
    detectKeywords: ['bkash'],
    // Fallback patterns unique to bKash:
    //   • "received payment tk" — exact phrase used only by bKash cash-in SMS
    //   • "fee tk 0.00" combined with TrxID — bKash fee format
    detectPatterns: [
      'received\\s+payment\\s+tk',
      'fee\\s+tk\\s+[\\d.]+\\.\\s*trxid',
    ],
    // bKash TrxID is always 10-char alphanumeric uppercase.
    // Require at least 6 chars to avoid matching short Nagad IDs.
    trxIdPatterns: ['TrxID\\s*[:.]?\\s*([A-Za-z0-9]{6,})'],
    amountPatterns: [
      'received\\s+payment\\s+Tk\\s*([\\d,.]+)',
      'sent\\s+Tk\\s*([\\d,.]+)',
      'cash\\s+out\\s+Tk\\s*([\\d,.]+)',
      'Tk\\s*([\\d,.]+)',
    ],
    sampleSms:
      'You have received payment Tk 780.00 from 01330231089. Fee Tk 0.00. Balance Tk 5,495.00. TrxID DEI4C6XD3M at 18/05/2026 14:25',
  },

  // ── Upay ──────────────────────────────────────────────────────────────────
  // Unique marker: "upay" (always in SMS body or sender name).
  // Fallback patterns kept empty — keyword "upay" is sufficient and unique.
  {
    provider: MfsProvider.Upay,
    enabled: true,
    priority: 4,
    detectKeywords: ['upay'],
    detectPatterns: [],
    trxIdPatterns: [
      'TrxID\\s*[:.]?\\s*([A-Za-z0-9]+)',
      'TxnID\\s*[:.]?\\s*([A-Za-z0-9]+)',
    ],
    amountPatterns: [
      'Amount:\\s*Tk\\s*([\\d,.]+)',
      'Tk\\s*([\\d,.]+)',
    ],
    sampleSms: '',
  },
];
