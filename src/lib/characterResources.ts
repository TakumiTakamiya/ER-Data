export function goldenSeedIncrease(quantity: number) {
  if (quantity >= 36) return 5;
  if (quantity >= 26) return 4;
  if (quantity >= 18) return 3;
  if (quantity >= 11) return 2;
  if (quantity >= 5) return 1;
  return 0;
}

export function sacredTearIncrease(quantity: number) {
  if (quantity >= 12) return 5;
  if (quantity >= 9) return 4;
  if (quantity >= 6) return 3;
  if (quantity >= 3) return 2;
  if (quantity >= 1) return 1;
  return 0;
}

export const cappedFlaskValue = (increase: number, modifier: number) => Math.max(0, Math.min(10, 4 + increase + modifier));
