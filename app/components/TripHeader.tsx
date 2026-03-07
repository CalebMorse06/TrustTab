"use client";

import { Trip } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { ParticipantAvatar } from "./ParticipantAvatar";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function TripHeader({ trip }: { trip: Trip }) {
  const totalExpenses = trip.expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4">
      <Link
        href="/"
        className="inline-flex items-center text-muted-foreground hover:text-foreground text-sm"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Link>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{trip.name}</h1>
          <p className="text-muted-foreground mt-1">
            ${totalExpenses.toFixed(2)} total &middot;{" "}
            {trip.expenses.length} expenses
          </p>
        </div>
        <Badge
          className={
            trip.status === "settled"
              ? "bg-[#10b981] text-white"
              : "text-[#f59e0b] border-[#f59e0b]/30"
          }
          variant={trip.status === "settled" ? "default" : "outline"}
        >
          {trip.status === "settled" ? "Settled" : "Active"}
        </Badge>
      </div>
      <div className="flex gap-3 flex-wrap">
        {trip.participants.map((p) => (
          <div key={p.id} className="flex flex-col items-center gap-1">
            <ParticipantAvatar participant={p} />
            <span className="text-xs text-muted-foreground">{p.name}</span>
            {p.wallet.address && (
              <span className="text-[10px] font-mono text-[#10b981]/60 max-w-[80px] truncate">
                {p.wallet.address.slice(0, 8)}...
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
