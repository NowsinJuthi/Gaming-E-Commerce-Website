import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ApproveMfsIntentDto } from './approve-mfs-intent.dto';

describe('ApproveMfsIntentDto', () => {
  it('requires an audit reason of at least 8 characters', async () => {
    const missing = plainToInstance(ApproveMfsIntentDto, {});
    const short = plainToInstance(ApproveMfsIntentDto, { reason: 'short' });
    const ok = plainToInstance(ApproveMfsIntentDto, {
      reason: 'Matched bank SMS after manual review',
    });
    expect(await validate(missing)).not.toHaveLength(0);
    expect(await validate(short)).not.toHaveLength(0);
    expect(await validate(ok)).toHaveLength(0);
  });
});
