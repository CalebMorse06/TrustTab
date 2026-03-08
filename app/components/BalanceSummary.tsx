"use client";

import { Trip } from "@/lib/types";
import { calculateBalances, minimizeDebts } from "@/lib/splits";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

export function BalanceSummary({ trip }: { trip: Trip }) {
  const balances = calculateBalances(trip.expenses, trip.participants);
  const obligations = minimizeDebts(trip.expenses, trip.participants);

  const getName = (id: string) =>
    trip.participants.find((p) => p.id === id)?.name || "Unknown";

  const maxAbs = Math.max(...balances.map((b) => Math.abs(b.amount)), 1);

  return (
    <Card className="surface">
      <CardContent className="p-5 space-y-4">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Balances</p>

        <div className="space-y-2">
          {balances.map((b) => {
            const name = getName(b.participantId);
            const pct = (Math.abs(b.amount) / maxAbs) * 100;
            const isPositive = b.amount > 0;

            return (
              <div key={b.participantId} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{name}</span>
                  <span
                    className="font-mono"
                    style={{ color: isPositive ? "#6b7c5e" : b.amount < 0 ? "#b45534" : "#8a7e72" }}
                  >
                    {isPositive ? "+" : ""}${b.amount.toFixed(2)}
                  </span>
                </div>
                <div className="h-px bg-border overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${Math.max(pct, 2)}%`,
                      backgroundColor: isPositive ? "#6b7c5e" : "#b45534",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {obligations.length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">
              Optimized Transfers ({obligations.length})
            </p>
            <div className="space-y-1">
              {obligations.map((o, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs border border-border px-3 py-2"
                >
                  <span className="font-medium">{getName(o.from)}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{getName(o.to)}</span>
                  <span className="ml-auto font-mono font-bold text-[#c2b59b]">
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
