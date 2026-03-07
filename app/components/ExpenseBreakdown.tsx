"use client";

import { Expense, Participant } from "@/lib/types";
import { ReceiptCard } from "./ReceiptCard";

export function ExpenseBreakdown({
  expenses,
  participants,
}: {
  expenses: Expense[];
  participants: Participant[];
}) {
  if (expenses.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No expenses yet. Upload a receipt to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {expenses.map((expense) => (
        <ReceiptCard
          key={expense.id}
          expense={expense}
          participants={participants}
        />
      ))}
    </div>
  );
}
