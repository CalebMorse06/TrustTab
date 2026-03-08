"use client";

import { Trip } from "@/lib/types";
import { ParticipantAvatar } from "./ParticipantAvatar";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function TripHeader({ trip }: { trip: Trip }) {
  const totalExpenses = trip.expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4">
      <Link
        href="/"
        className="inline-flex items-center text-muted-foreground hover:text-foreground text-xs font-mono"
      >
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
      </Link>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{trip.name}</h1>
          <p className="text-muted-foreground text-sm font-mono mt-1">
            ${totalExpenses.toFixed(2)} total / {trip.expenses.length} expenses
          </p>
        </div>
        <span
          className="text-[10px] font-mono uppercase tracking-wider"
          style={{ color: trip.status === "settled" ? "#6b7c5e" : "#c4893b" }}
        >
          {trip.status}
        </span>
      </div>
      <div className="flex gap-3 flex-wrap">
        {trip.participants.map((p, i) => (
          <div key={p.id} className="flex flex-col items-center gap-1">
            <ParticipantAvatar participant={p} index={i} />
            <span className="text-[10px] text-muted-foreground">{p.name}</span>
            {p.wallet.address && (
              <span className="text-[8px] font-mono text-muted-foreground/50 max-w-[80px] truncate">
                {p.wallet.address.slice(0, 8)}...
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
