import { Logger } from '@nestjs/common';

/** Runs a side effect without letting failures propagate to callers or sibling steps. */
export async function runIsolatedSideEffect(
  label: string,
  logger: Logger,
  run: () => Promise<void>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    logger.error(
      `${label} failed: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error.stack : undefined,
    );
  }
}

/** Fire-and-forget wrapper around {@link runIsolatedSideEffect}. */
export function runIsolatedSideEffectVoid(
  label: string,
  logger: Logger,
  run: () => Promise<void>,
): void {
  void runIsolatedSideEffect(label, logger, run);
}
