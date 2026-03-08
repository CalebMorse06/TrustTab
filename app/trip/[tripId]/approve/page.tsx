"use client";

import { use, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trip } from "@/lib/types";
import { minimizeDebts } from "@/lib/splits";
import {
  ShieldCheck, Loader2, ArrowRight, ArrowLeft, Zap,
  CheckCircle, Smartphone, Fingerprint,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const ACCENT_COLORS = ["#b45534", "#6b7c5e", "#c2b59b", "#c4893b", "#8a7e72"];

export default function ApprovePage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = use(params);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadTrip = async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      if (res.ok) {
        const data: Trip = await res.json();
        setTrip(data);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadTrip();
    const id = setInterval(loadTrip, 3000);
    return () => clearInterval(id);
  }, [tripId]);

  const handleApprove = async (participantId: string) => {
    setApprovingId(participantId);
    try {
      await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, participantId, approved: true }),
      });
      await loadTrip();
    } catch {}
    setApprovingId(null);
  };

  if (loading || !trip) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  const obligations = trip.expenses.length > 0 ? minimizeDebts(trip.expenses, trip.participants) : [];
  const getName = (id: string) => trip.participants.find((p) => p.id === id)?.name || "?";
  const approvals = trip.approvals || {};
  const approvedCount = trip.participants.filter((p) => approvals[p.id]?.approved).length;
  const allApproved = approvedCount === trip.participants.length;

  return (
    <div className="space-y-6 pb-16">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link
          href={`/trip/${tripId}`}
          className="inline-flex items-center text-muted-foreground hover:text-foreground text-xs font-mono"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Trip
        </Link>
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#c4893b]">
          <Smartphone className="h-3 w-3" />
          <span className="uppercase tracking-[0.2em]">Participant Consent</span>
        </div>
      </div>

      {/* Header */}
      <div>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mb-2">
          {trip.name}
        </p>
        <h1 className="text-3xl font-bold">Approve Settlement</h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-md">
          Each participant reviews what they owe and approves the on-chain settlement.
          In production, each person does this on their own device.
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3 border border-border p-4">
        <div className="flex gap-1">
          {trip.participants.map((p, i) => (
            <motion.div
              key={p.id}
              className="w-3 h-3"
              style={{
                backgroundColor: approvals[p.id]?.approved ? "#6b7c5e" : "#2e2b29",
              }}
              animate={approvals[p.id]?.approved ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          {approvedCount}/{trip.participants.length} approved
        </span>
        {allApproved && (
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="ml-auto text-xs font-mono text-[#6b7c5e] font-bold"
          >
            READY TO SETTLE
          </motion.span>
        )}
      </div>

      {/* Transfers overview */}
      {obligations.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            Optimized Transfers
          </p>
          {obligations.map((o, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border border-border px-4 py-3"
            >
              <div
                className="w-8 h-8 bg-secondary flex items-center justify-center font-mono font-bold text-sm"
                style={{
                  borderLeft: `2px solid ${ACCENT_COLORS[trip.participants.findIndex((p) => p.id === o.from) % ACCENT_COLORS.length]}`,
                }}
              >
                {getName(o.from).charAt(0)}
              </div>
              <span className="text-xs">{getName(o.from)}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <div
                className="w-8 h-8 bg-secondary flex items-center justify-center font-mono font-bold text-sm"
                style={{
                  borderLeft: `2px solid ${ACCENT_COLORS[trip.participants.findIndex((p) => p.id === o.to) % ACCENT_COLORS.length]}`,
                }}
              >
                {getName(o.to).charAt(0)}
              </div>
              <span className="text-xs">{getName(o.to)}</span>
              <span className="ml-auto font-mono font-bold text-sm text-[#c2b59b]">
                ${o.rlusdAmount.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Participant cards */}
      <div className="space-y-3">
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Participants
        </p>
        {trip.participants.map((p, i) => {
          const isApproved = approvals[p.id]?.approved;
          const myObligations = obligations.filter(
            (o) => o.from === p.id || o.to === p.id
          );
          const netOwed = myObligations.reduce((sum, o) => {
            if (o.from === p.id) return sum - o.rlusdAmount;
            return sum + o.rlusdAmount;
          }, 0);

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="border p-5 space-y-4"
              style={{
                borderColor: isApproved
                  ? "rgba(107,124,94,0.3)"
                  : "var(--border)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 bg-secondary flex items-center justify-center font-mono font-bold text-xl"
                  style={{
                    borderLeft: `3px solid ${ACCENT_COLORS[i % ACCENT_COLORS.length]}`,
                  }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg">{p.name}</p>
                  {p.wallet?.address && (
                    <p className="text-[9px] font-mono text-muted-foreground">
                      {p.wallet.address.slice(0, 10)}...{p.wallet.address.slice(-6)}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p
                    className="font-mono font-bold text-lg"
                    style={{
                      color:
                        netOwed > 0.01
                          ? "#6b7c5e"
                          : netOwed < -0.01
                            ? "#b45534"
                            : "#8a7e72",
                    }}
                  >
                    {netOwed > 0 ? "+" : ""}${netOwed.toFixed(2)}
                  </p>
                  <p className="text-[9px] font-mono text-muted-foreground">
                    {netOwed > 0.01 ? "receives" : netOwed < -0.01 ? "owes" : "even"}
                  </p>
                </div>
              </div>

              {/* What they owe/receive */}
              {myObligations.length > 0 && (
                <div className="space-y-1">
                  {myObligations.map((o, oi) => {
                    const isSender = o.from === p.id;
                    return (
                      <div
                        key={oi}
                        className="flex items-center gap-2 text-xs px-3 py-1.5 bg-secondary/30"
                      >
                        <span
                          style={{
                            color: isSender ? "#b45534" : "#6b7c5e",
                          }}
                          className="font-mono text-[10px] font-bold w-14"
                        >
                          {isSender ? "PAY" : "RECEIVE"}
                        </span>
                        <span className="text-muted-foreground">
                          {isSender ? getName(o.to) : getName(o.from)}
                        </span>
                        <span
                          className="ml-auto font-mono font-bold"
                          style={{
                            color: isSender ? "#b45534" : "#6b7c5e",
                          }}
                        >
                          {isSender ? "-" : "+"}${o.rlusdAmount.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Approve button */}
              <AnimatePresence mode="wait">
                {isApproved ? (
                  <motion.div
                    key="approved"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 border border-[#6b7c5e]/20 p-3"
                  >
                    <CheckCircle className="h-4 w-4 text-[#6b7c5e]" />
                    <p className="text-sm font-semibold text-[#6b7c5e]">
                      Approved
                    </p>
                    <span className="ml-auto text-[9px] font-mono text-muted-foreground">
                      {new Date(approvals[p.id].timestamp).toLocaleTimeString()}
                    </span>
                  </motion.div>
                ) : (
                  <motion.div key="pending">
                    <Button
                      onClick={() => handleApprove(p.id)}
                      disabled={approvingId === p.id}
                      className="w-full bg-[#6b7c5e] hover:bg-[#5a6b4f] text-white border-0 font-semibold py-5"
                    >
                      {approvingId === p.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Approve as {p.name}
                        </>
                      )}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* All approved CTA */}
      <AnimatePresence>
        {allApproved && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="border border-[#6b7c5e]/30 p-5 text-center space-y-2">
              <CheckCircle className="h-8 w-8 text-[#6b7c5e] mx-auto" />
              <p className="font-bold text-[#6b7c5e] text-lg">
                All Participants Approved
              </p>
              <p className="text-xs text-muted-foreground">
                Settlement is now authorized. Return to the trip to execute
                on-chain.
              </p>
            </div>
            <Link href={`/trip/${tripId}`}>
              <Button className="w-full bg-[#b45534] hover:bg-[#9a4529] text-white border-0 font-bold text-base py-6">
                <Zap className="mr-2 h-5 w-5" />
                Back to Trip — Settle on XRPL
              </Button>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
