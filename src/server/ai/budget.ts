export const DEFAULT_MONTHLY_BUDGET_USD = 25.0;

export interface BudgetStatus {
  monthlyLimitUsd: number;
  currentSpendUsd: number;
  remainingUsd: number;
  isExceeded: boolean;
}

export class AiBudgetExceededError extends Error {
  constructor(currentSpend: number, limit: number) {
    super(
      `AI monthly budget exceeded: spent $${currentSpend.toFixed(2)} of $${limit.toFixed(2)} limit.`
    );
    this.name = "AiBudgetExceededError";
  }
}

/**
 * Parses configured budget or falls back to default.
 */
export function getMonthlyBudgetLimit(): number {
  const envVal = process.env.AI_MONTHLY_BUDGET_USD;
  if (!envVal) return DEFAULT_MONTHLY_BUDGET_USD;
  const parsed = parseFloat(envVal);
  return isNaN(parsed) || parsed <= 0 ? DEFAULT_MONTHLY_BUDGET_USD : parsed;
}

/**
 * Evaluates current monthly spend against configured limit.
 */
export function checkBudgetStatus(currentSpendUsd: number): BudgetStatus {
  const monthlyLimitUsd = getMonthlyBudgetLimit();
  const remainingUsd = Math.max(0, monthlyLimitUsd - currentSpendUsd);
  return {
    monthlyLimitUsd,
    currentSpendUsd,
    remainingUsd,
    isExceeded: currentSpendUsd >= monthlyLimitUsd
  };
}

/**
 * Asserts that the new projected spend is within the monthly budget limit.
 */
export function assertWithinMonthlyBudget(currentSpendUsd: number, projectedCostUsd = 0): void {
  const monthlyLimitUsd = getMonthlyBudgetLimit();
  if (currentSpendUsd + projectedCostUsd > monthlyLimitUsd) {
    throw new AiBudgetExceededError(currentSpendUsd + projectedCostUsd, monthlyLimitUsd);
  }
}
