import { BadRequestException } from '@nestjs/common';
import { isIP } from 'node:net';
import type { AccessBlockType } from '../database/schemas/access-block.schema';

export function normalizeAccessBlockValue(
  type: AccessBlockType,
  value: string,
): string {
  const trimmed = value.trim();
  if (type === 'country') {
    return trimmed.toUpperCase();
  }
  return trimmed;
}

export function assertValidAccessBlockValue(
  type: AccessBlockType,
  value: string,
): string {
  const normalized = normalizeAccessBlockValue(type, value);
  if (type === 'country') {
    if (!/^[A-Z]{2}$/.test(normalized)) {
      throw new BadRequestException(
        'Country must be a 2-letter ISO code (e.g. BD, US).',
      );
    }
    return normalized;
  }
  if (!isIP(normalized)) {
    throw new BadRequestException('Invalid IP address.');
  }
  return normalized;
}
