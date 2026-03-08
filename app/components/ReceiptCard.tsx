"use client";

import { Expense, Participant } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

export function ReceiptCard({
  expense,
  participants,
}: {
  expense: Expense;
  participants: Participant[];
}) {
  const payer = participants.find((p) => p.id === expense.paidBy);
  const extracted = expense.receipt?.extractedData;

  return (
    <Card className="surface">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">{expense.description}</h3>
            <p className="text-xs text-muted-foreground">
              Paid by {payer?.name || "Unknown"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-mono font-bold text-[#c2b59b]">
              ${expense.amount.toFixed(2)}
            </p>
            <span
              className="text-[10px] font-mono uppercase tracking-wider"
              style={{ color: expense.status === "settled" ? "#6b7c5e" : "#c4893b" }}
            >
              {expense.status}
            </span>
          </div>
        </div>

        {extracted && (
          <div className="border border-border p-3 text-sm space-y-1">
            <div className="flex justify-between text-muted-foreground text-xs">
              <span>{extracted.vendor}</span>
              <span className="font-mono">{extracted.date}</span>
            </div>
            {extracted.lineItems.slice(0, 4).map((item, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span>
                  {item.name} {item.quantity > 1 ? `x${item.quantity}` : ""}
                </span>
                <span className="font-mono">${item.price.toFixed(2)}</span>
              </div>
            ))}
            {extracted.lineItems.length > 4 && (
              <p className="text-muted-foreground text-xs">
                +{extracted.lineItems.length - 4} more
              </p>
            )}
            <div className="border-t border-border pt-1 mt-1 flex justify-between font-semibold text-xs">
              <span>Total</span>
              <span className="font-mono">${extracted.total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {expense.receipt?.pinataCid && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
            <span className="truncate">CID: {expense.receipt.pinataCid}</span>
            <a
              href={`https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY || "gateway.pinata.cloud"}/ipfs/${expense.receipt.pinataCid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#b45534] hover:opacity-80"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        <div className="flex gap-1 flex-wrap">
          {expense.splits.map((split) => {
            const person = participants.find((p) => p.id === split.participantId);
            return (
              <span
                key={split.participantId}
                className="text-[10px] font-mono border border-border px-2 py-0.5 text-muted-foreground"
              >
                {person?.name}: ${split.amount.toFixed(2)}
              </span>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
