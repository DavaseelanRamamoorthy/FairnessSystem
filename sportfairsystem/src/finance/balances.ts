// Pure money helpers. The database views (v_member_dues, v_balance_sheet,
// v_tournament_costs) compute the same numbers; these functions back the UI
// previews and are what the tests pin down.

export type Charge = { id: string; memberId: string; amount: number; currency: string; cancelled?: boolean };
export type Payment = { chargeId: string; amount: number; currency: string; amountEur: number };
export type Transaction = { date: string; direction: "income" | "expense"; amountEur: number };

const cents = (value: number) => Math.round(value * 100) / 100;

export function computeDues(charges: Charge[], payments: Payment[]) {
  return charges
    .filter((charge) => !charge.cancelled)
    .map((charge) => {
      const paid = payments
        .filter((p) => p.chargeId === charge.id)
        .reduce((sum, p) => sum + (p.currency === charge.currency ? p.amount : p.amountEur), 0);
      return { ...charge, paid: cents(paid), outstanding: cents(charge.amount - paid) };
    });
}

export function isPaidInFull(charge: Charge, payments: Payment[]) {
  return computeDues([charge], payments)[0].outstanding <= 0;
}

/** Monthly income/expense with a running balance; closing carries to next season. */
export function balanceSheet(transactions: Transaction[], openingBalance = 0) {
  const months = new Map<string, { income: number; expenses: number }>();
  for (const t of [...transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    const key = t.date.slice(0, 7);
    const month = months.get(key) ?? { income: 0, expenses: 0 };
    if (t.direction === "income") month.income += t.amountEur;
    else month.expenses += t.amountEur;
    months.set(key, month);
  }
  let running = openingBalance;
  const rows = [...months.entries()].map(([month, { income, expenses }]) => {
    running += income - expenses;
    return { month, income: cents(income), expenses: cents(expenses), closing: cents(running) };
  });
  const income = cents(rows.reduce((s, r) => s + r.income, 0));
  const expenses = cents(rows.reduce((s, r) => s + r.expenses, 0));
  return { openingBalance: cents(openingBalance), rows, income, expenses, closingBalance: cents(running) };
}

/**
 * Splits a tournament's actual cost across the players who took part and
 * works out what each player is owed back (positive) or still owes (negative).
 */
export function tournamentSplit(actualTotal: number, paidByPlayer: Map<string, number>) {
  const players = [...paidByPlayer.keys()];
  if (players.length === 0) return { perHead: 0, balances: new Map<string, number>() };
  const perHead = cents(actualTotal / players.length);
  const balances = new Map(players.map((id) => [id, cents((paidByPlayer.get(id) ?? 0) - perHead)] as const));
  return { perHead, balances };
}
