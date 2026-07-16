/**
 * Per-user row quota, applied in every create/restore server action. This is
 * the storage-abuse cap for a public deployment: rate limiting slows a
 * scripted abuser down, the quota bounds the total damage. Reused by every
 * module as it migrates to the database.
 */

export const MAX_ITEMS_PER_MODEL = 5000;

export class QuotaExceededError extends Error {
  constructor(model: string) {
    super(`You've reached the limit of ${MAX_ITEMS_PER_MODEL} ${model}. Archive or delete some first.`);
    this.name = "QuotaExceededError";
  }
}

export function assertUnderQuota(count: number, model: string): void {
  if (count >= MAX_ITEMS_PER_MODEL) {
    throw new QuotaExceededError(model);
  }
}
