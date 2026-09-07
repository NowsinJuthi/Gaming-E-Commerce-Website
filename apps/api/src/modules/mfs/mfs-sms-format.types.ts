import { MfsProvider } from '../../common/enums';

export type MfsSmsProviderFormatConfig = {
  provider: MfsProvider;
  enabled: boolean;
  priority: number;
  detectKeywords: string[];
  detectPatterns: string[];
  trxIdPatterns: string[];
  amountPatterns: string[];
  sampleSms: string;
};

export type MfsSmsFormatsResponse = {
  providers: MfsSmsProviderFormatConfig[];
  updatedAt?: string;
};

export type MfsSmsParseTestResult = {
  provider: string;
  trxId?: string;
  amount?: number;
  allowed: boolean;
};
