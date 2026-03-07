"use client";

import { Expense, Participant } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt, ExternalLink } from "lucide-react";

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
    <Card className="glass-card">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#10b981]/10 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-[#10b981]" />
            </div>
            <div>
              <h3 className="font-semibold">{expense.description}</h3>
              <p className="text-sm text-muted-foreground">
                Paid by {payer?.name || "Unknown"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-[#10b981]">
              ${expense.amount.toFixed(2)}
            </p>
            <Badge
              variant="outline"
              className={
                expense.status === "settled"
                  ? "text-[#10b981] border-[#10b981]/30"
                  : "text-[#f59e0b] border-[#f59e0b]/30"
              }
            >
              {expense.status}
            </Badge>
          </div>
        </div>

        {/* Extracted receipt data */}
        {extracted && (
          <div className="bg-background/50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>{extracted.vendor}</span>
              <span>{extracted.date}</span>
            </div>
            {extracted.lineItems.slice(0, 4).map((item, i) => (
              <div key={i} className="flex justify-between">
                <span>
                  {item.name} {item.quantity > 1 ? `x${item.quantity}` : ""}
                </span>
                <span>${item.price.toFixed(2)}</span>
              </div>
            ))}
            {extracted.lineItems.length > 4 && (
              <p className="text-muted-foreground">
                +{extracted.lineItems.length - 4} more items
              </p>
            )}
            <div className="border-t border-border pt-1 mt-1 flex justify-between font-semibold">
              <span>Total</span>
              <span>${extracted.total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Pinata CID */}
        {expense.receipt?.pinataCid && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono truncate">
              CID: {expense.receipt.pinataCid}
            </span>
            <a
              href={`https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY || "gateway.pinata.cloud"}/ipfs/${expense.receipt.pinataCid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#f59e0b] hover:underline flex items-center"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Splits */}
        <div className="flex gap-1 flex-wrap">
          {expense.splits.map((split) => {
            const person = participants.find(
              (p) => p.id === split.participantId
            );
            return (
              <Badge
                key={split.participantId}
                variant="outline"
                className="text-xs"
              >
                {person?.name}: ${split.amount.toFixed(2)}
              </Badge>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
