import { describe, expect, it } from "vitest";
import { balanceSheet, computeDues, isPaidInFull, tournamentSplit } from "./balances";

describe("dues", () => {
  const charge = { id: "c1", memberId: "m1", amount: 40, currency: "EUR" };

  it("subtracts payments and treats over-payment as settled", () => {
    expect(computeDues([charge], [{ chargeId: "c1", amount: 25, currency: "EUR", amountEur: 25 }])[0].outstanding).toBe(15);
    expect(isPaidInFull(charge, [{ chargeId: "c1", amount: 45, currency: "EUR", amountEur: 45 }])).toBe(true);
  });

  it("uses the EUR value for payments made in another currency", () => {
    const dues = computeDues([charge], [{ chargeId: "c1", amount: 3600, currency: "INR", amountEur: 40 }]);
    expect(dues[0].outstanding).toBe(0);
  });

  it("ignores cancelled charges", () => {
    expect(computeDues([{ ...charge, cancelled: true }], [])).toEqual([]);
  });
});

describe("balance sheet", () => {
  it("matches the club sheet: 2025 received 586, spent 494.37, balance 91.63", () => {
    const sheet = balanceSheet([
      { date: "2025-04-10", direction: "income", amountEur: 586 },
      { date: "2025-06-01", direction: "expense", amountEur: 494.37 }
    ]);
    expect(sheet.closingBalance).toBe(91.63);
  });

  it("carries the closing balance forward as next season's opening balance", () => {
    const y2025 = balanceSheet([{ date: "2025-04-10", direction: "income", amountEur: 91.63 }]);
    const y2026 = balanceSheet([{ date: "2026-03-01", direction: "expense", amountEur: 20 }], y2025.closingBalance);
    expect(y2026.openingBalance).toBe(91.63);
    expect(y2026.closingBalance).toBe(71.63);
    expect(y2026.rows).toEqual([{ month: "2026-03", income: 0, expenses: 20, closing: 71.63 }]);
  });
});

describe("tournament split", () => {
  it("splits the actual cost and computes balance to return", () => {
    const paid = new Map([["a", 30], ["b", 30], ["c", 20]]);
    const { perHead, balances } = tournamentSplit(75, paid);
    expect(perHead).toBe(25);
    expect(balances.get("a")).toBe(5); // to return
    expect(balances.get("c")).toBe(-5); // still owes
  });
});
