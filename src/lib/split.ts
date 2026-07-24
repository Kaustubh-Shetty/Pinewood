// Deterministic equal split with remainder handling.
// Amounts are integer paise so there is no floating-point drift.
// Remainder rupees go to the first N flats when sorted alphabetically by
// flatId — deterministic and reproducible by anyone re-checking the math.
//
// NOTE: this is used client-side only to show a live preview while filling
// the Add Bill form. The Cloud Function `addBill` recomputes this exact same
// logic server-side and that server result is the one actually saved —
// the client's number is never trusted as-is.
export function computeEqualSplit(totalAmountPaise: number, flatIds: string[]): Record<string, number> {
  if (flatIds.length === 0) throw new Error('At least one flat must be selected');
  if (!Number.isInteger(totalAmountPaise) || totalAmountPaise <= 0) {
    throw new Error('Amount must be a positive number');
  }

  const n = flatIds.length;
  const base = Math.floor(totalAmountPaise / n);
  const remainder = totalAmountPaise - base * n;
  const sorted = [...flatIds].sort();

  const shares: Record<string, number> = {};
  sorted.forEach((flatId, index) => {
    shares[flatId] = base + (index < remainder ? 1 : 0);
  });
  return shares;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
