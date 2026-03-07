import { Expense, Obligation, Participant } from "./types";

interface Balance {
  participantId: string;
  amount: number; // positive = owed money, negative = owes money
}

export function calculateBalances(
  expenses: Expense[],
  participants: Participant[]
): Balance[] {
  const balanceMap = new Map<string, number>();

  // Initialize all participants
  for (const p of participants) {
    balanceMap.set(p.id, 0);
  }

  for (const expense of expenses) {
    // The payer is owed the total amount
    const current = balanceMap.get(expense.paidBy) || 0;
    balanceMap.set(expense.paidBy, current + expense.amount);

    // Each person in the split owes their share
    for (const split of expense.splits) {
      const cur = balanceMap.get(split.participantId) || 0;
      balanceMap.set(split.participantId, cur - split.amount);
    }
  }

  return Array.from(balanceMap.entries()).map(([participantId, amount]) => ({
    participantId,
    amount: Math.round(amount * 100) / 100,
  }));
}

export function minimizeDebts(
  expenses: Expense[],
  participants: Participant[]
): Obligation[] {
  const balances = calculateBalances(expenses, participants);

  // Separate into creditors (positive balance) and debtors (negative balance)
  const creditors: Balance[] = [];
  const debtors: Balance[] = [];

  for (const b of balances) {
    if (b.amount > 0.01) {
      creditors.push({ ...b });
    } else if (b.amount < -0.01) {
      debtors.push({ participantId: b.participantId, amount: -b.amount });
    }
  }

  // Sort descending by amount (greedy matching)
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const obligations: Obligation[] = [];

  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    const rounded = Math.round(amount * 100) / 100;

    if (rounded > 0) {
      obligations.push({
        from: debtors[i].participantId,
        to: creditors[j].participantId,
        amount: rounded,
        rlusdAmount: rounded,
        status: "pending",
      });
    }

    debtors[i].amount -= amount;
    creditors[j].amount -= amount;

    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return obligations;
}

export function createEqualSplits(
  amount: number,
  participantIds: string[]
): { participantId: string; amount: number; settled: boolean }[] {
  const share = Math.round((amount / participantIds.length) * 100) / 100;
  // Adjust last person for rounding
  return participantIds.map((id, idx) => ({
    participantId: id,
    amount:
      idx === participantIds.length - 1
        ? Math.round((amount - share * (participantIds.length - 1)) * 100) / 100
        : share,
    settled: false,
  }));
}
