"use client";

import { Trip } from "@/lib/types";
import { calculateBalances, minimizeDebts } from "@/lib/splits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

export function BalanceSummary({ trip }: { trip: Trip }) {
  const balances = calculateBalances(trip.expenses, trip.participants);
  const obligations = minimizeDebts(trip.expenses, trip.participants);

  const getName = (id: string) =>
    trip.participants.find((p) => p.id === id)?.name || "Unknown";

  const maxAbs = Math.max(...balances.map((b) => Math.abs(b.amount)), 1);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg">Balances</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance bars */}
        <div className="space-y-2">
          {balances.map((b) => {
            const name = getName(b.participantId);
            const pct = (Math.abs(b.amount) / maxAbs) * 100;
            const isPositive = b.amount > 0;

            return (
              <div key={b.participantId} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{name}</span>
                  <span
                    className={
                      isPositive ? "text-[#10b981]" : b.amount < 0 ? "text-[#ef4444]" : "text-muted-foreground"
                    }
                  >
                    {isPositive ? "+" : ""}
                    ${b.amount.toFixed(2)}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isPositive ? "bg-[#10b981]" : "bg-[#ef4444]"
                    }`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Obligations */}
        {obligations.length > 0 && (
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
              Optimized Transfers ({obligations.length})
            </h4>
            <div className="space-y-2">
              {obligations.map((o, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm bg-background/50 rounded-lg px-3 py-2"
                >
                  <span className="font-medium">{getName(o.from)}</span>
                  <ArrowRight className="h-4 w-4 text-[#f59e0b]" />
                  <span className="font-medium">{getName(o.to)}</span>
                  <span className="ml-auto text-[#10b981] font-bold">
                    ${o.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
