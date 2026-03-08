"use client";

import { use, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trip, LiveObligation } from "@/lib/types";
import { minimizeDebts } from "@/lib/splits";
import { CheckCircle, Loader2, XCircle, ArrowDownLeft, ArrowUpRight, Wifi, WifiOff, Zap, ShieldCheck, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const ACCENT_COLORS = ["#b45534", "#6b7c5e", "#c2b59b", "#c4893b", "#8a7e72"];

type WalletBalance = { xrp: string };

export default function WalletPage({ params }: { params: Promise<{ tripId: string; participantId: string }> }) {
  const { tripId, participantId } = use(params);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [connected, setConnected] = useState(true);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [prevBalance, setPrevBalance] = useState<string | null>(null);
  const [balanceFlash, setBalanceFlash] = useState<"up" | "down" | null>(null);
  const [approving, setApproving] = useState(false);
  const [declining, setDeclining] = useState(false);

  // Poll trip data
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}`);
        if (res.ok) {
          const data: Trip = await res.json();
          if (active) { setTrip(data); setConnected(true); }
        }
      } catch {
        if (active) setConnected(false);
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => { active = false; clearInterval(id); };
  }, [tripId]);

  // Poll wallet balance
  useEffect(() => {
    if (!trip) return;
    const participant = trip.participants.find((p) => p.id === participantId);
    if (!participant?.wallet?.address) return;

    let active = true;
    const addr = participant.wallet.address;
    const pollBalance = async () => {
      try {
        const res = await fetch(`/api/balances?address=${addr}`);
        if (res.ok && active) {
          const data = await res.json();
          setBalance((prev) => {
            if (prev && prev.xrp !== data.xrp) {
              setPrevBalance(prev.xrp);
              const dir = parseFloat(data.xrp) > parseFloat(prev.xrp) ? "up" : "down";
              setBalanceFlash(dir);
              setTimeout(() => setBalanceFlash(null), 2000);
            }
            return { xrp: data.xrp };
          });
        }
      } catch {}
    };
    pollBalance();
    const id = setInterval(pollBalance, 3000);
    return () => { active = false; clearInterval(id); };
  }, [trip?.participants.find((p) => p.id === participantId)?.wallet?.address]);

  const handleApproval = async (approved: boolean) => {
    if (approved) setApproving(true);
    else setDeclining(true);
    try {
      await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, participantId, approved }),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setApproving(false);
      setDeclining(false);
    }
  };

  const participant = trip?.participants.find((p) => p.id === participantId);
  const participantIdx = trip?.participants.findIndex((p) => p.id === participantId) ?? 0;
  const accentColor = ACCENT_COLORS[participantIdx % ACCENT_COLORS.length];

  const phase = trip?.settlementStatus?.phase ?? "idle";
  const liveObligations: LiveObligation[] = trip?.settlementStatus?.obligations ?? [];
  const pendingObligations = trip ? minimizeDebts(trip.expenses, trip.participants) : [];
  const allObligations: LiveObligation[] = liveObligations.length > 0 ? liveObligations : (pendingObligations as LiveObligation[]);

  const myObligations = allObligations.filter((o) => o.from === participantId || o.to === participantId);
  const getName = (id: string) => trip?.participants.find((p) => p.id === id)?.name ?? "Unknown";

  const myApproval = trip?.approvals?.[participantId];
  const allApproved = trip?.participants.every((p) => trip.approvals?.[p.id]?.approved) ?? false;
  const approvalCount = trip?.participants.filter((p) => trip.approvals?.[p.id]?.approved).length ?? 0;

  const myReceiptCid = trip?.settlementStatus?.participantCids?.[participantId];
  const gateway = typeof window !== "undefined" ? "" : "";

  if (!trip || !participant) {
    return (
      <div className="min-h-screen bg-[#0a0a09] text-[#e8e2d9] flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-[#c4893b] animate-spin" />
      </div>
    );
  }

  const balanceChange = prevBalance && balance ? parseFloat(balance.xrp) - parseFloat(prevBalance) : 0;
  const netOwed = myObligations.reduce((sum, o) => {
    if (o.from === participantId) return sum - o.rlusdAmount;
    return sum + o.rlusdAmount;
  }, 0);

  return (
    <div className="min-h-screen bg-[#0a0a09] text-[#e8e2d9] flex flex-col">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-1.5 text-[9px] font-mono">
          <Zap className="h-3 w-3 text-[#c4893b]" />
          <span className="text-[#c4893b] uppercase tracking-[0.2em]">TrustTab</span>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] font-mono">
          {connected ? (
            <><Wifi className="h-3 w-3 text-[#6b7c5e]" /><span className="text-[#6b7c5e]">LIVE</span></>
          ) : (
            <><WifiOff className="h-3 w-3 text-[#b45534]" /><span className="text-[#b45534]">OFFLINE</span></>
          )}
        </div>
      </div>

      {/* Identity */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-4">
        <div className="w-14 h-14 bg-[#1c1a19] flex items-center justify-center font-mono font-bold text-2xl"
          style={{ borderLeft: `4px solid ${accentColor}` }}>
          {participant.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-extrabold">{participant.name}</p>
          {participant.wallet.address && (
            <p className="text-[8px] font-mono text-[#8a7e72] mt-0.5 truncate">{participant.wallet.address}</p>
          )}
        </div>
      </div>

      {/* Balance */}
      <motion.div
        className="mx-4 border p-5 text-center"
        style={{ borderColor: balanceFlash === "up" ? "#6b7c5e" : balanceFlash === "down" ? "#b45534" : "#2e2b29" }}
        animate={balanceFlash ? { scale: [1, 1.02, 1] } : {}}
        transition={{ duration: 0.3 }}
      >
        <p className="text-[9px] font-mono text-[#8a7e72] uppercase tracking-widest mb-1">Balance</p>
        {balance ? (
          <>
            <motion.p
              className="text-4xl font-mono font-extrabold"
              style={{ color: balanceFlash === "up" ? "#6b7c5e" : balanceFlash === "down" ? "#b45534" : "#c2b59b" }}
              key={balance.xrp}
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {parseFloat(balance.xrp).toFixed(2)}
            </motion.p>
            <p className="text-[10px] font-mono text-[#8a7e72] mt-0.5">XRP</p>
            <AnimatePresence>
              {balanceFlash && balanceChange !== 0 && (
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm font-mono font-bold mt-1"
                  style={{ color: balanceChange > 0 ? "#6b7c5e" : "#b45534" }}
                >
                  {balanceChange > 0 ? "+" : ""}{balanceChange.toFixed(2)} XRP
                </motion.p>
              )}
            </AnimatePresence>
          </>
        ) : participant.wallet.address ? (
          <Loader2 className="h-5 w-5 text-[#c4893b] animate-spin mx-auto" />
        ) : (
          <p className="text-lg font-mono text-[#8a7e72]">No wallet</p>
        )}
      </motion.div>

      {/* Consent / Approval Section */}
      {phase !== "complete" && myObligations.length > 0 && trip.status !== "settled" && (
        <div className="mx-4 mt-3 border border-[#2e2b29] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#c4893b]" />
            <p className="text-[10px] font-mono text-[#c4893b] uppercase tracking-widest">Settlement Consent</p>
          </div>

          {/* What you owe / are owed */}
          <div className="space-y-1.5">
            {myObligations.map((o, i) => {
              const isSender = o.from === participantId;
              const otherName = isSender ? (o.toName || getName(o.to)) : (o.fromName || getName(o.from));
              return (
                <div key={i} className="flex items-center justify-between text-xs border border-[#2e2b29] px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {isSender ? (
                      <ArrowUpRight className="h-3 w-3 text-[#b45534]" />
                    ) : (
                      <ArrowDownLeft className="h-3 w-3 text-[#6b7c5e]" />
                    )}
                    <span>{isSender ? `Pay ${otherName}` : `Receive from ${otherName}`}</span>
                  </div>
                  <span className="font-mono font-bold" style={{ color: isSender ? "#b45534" : "#6b7c5e" }}>
                    {isSender ? "-" : "+"}${o.rlusdAmount.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="border-t border-[#2e2b29] pt-2 flex items-center justify-between text-xs">
            <span className="text-[#8a7e72]">Net</span>
            <span className="font-mono font-bold" style={{ color: netOwed >= 0 ? "#6b7c5e" : "#b45534" }}>
              {netOwed >= 0 ? "+" : ""}${netOwed.toFixed(2)}
            </span>
          </div>

          {/* Approval status of others */}
          <div className="flex items-center gap-2 text-[9px] font-mono text-[#8a7e72]">
            <span>{approvalCount}/{trip.participants.length} approved</span>
            <div className="flex gap-1">
              {trip.participants.map((p, i) => (
                <div key={p.id} className="w-2 h-2"
                  style={{ backgroundColor: trip.approvals?.[p.id]?.approved ? "#6b7c5e" : "#2e2b29" }} />
              ))}
            </div>
          </div>

          {/* Action buttons */}
          {!myApproval ? (
            <div className="flex gap-2">
              <Button
                onClick={() => handleApproval(true)}
                disabled={approving || declining}
                className="flex-1 bg-[#6b7c5e] hover:bg-[#5a6b4f] text-white border-0 font-semibold"
              >
                {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldCheck className="mr-2 h-4 w-4" />Approve</>}
              </Button>
              <Button
                onClick={() => handleApproval(false)}
                disabled={approving || declining}
                variant="outline"
                className="border-[#b45534]/30 text-[#b45534] hover:bg-[#b45534]/10"
              >
                {declining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Decline"}
              </Button>
            </div>
          ) : myApproval.approved ? (
            <div className="flex items-center gap-2 border border-[#6b7c5e]/20 p-3">
              <CheckCircle className="h-4 w-4 text-[#6b7c5e]" />
              <div>
                <p className="text-xs font-bold text-[#6b7c5e]">You approved</p>
                <p className="text-[9px] font-mono text-[#8a7e72]">
                  {allApproved ? "All parties approved — settlement can proceed" : `Waiting for ${trip.participants.length - approvalCount} more`}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 border border-[#b45534]/20 p-3">
              <XCircle className="h-4 w-4 text-[#b45534]" />
              <p className="text-xs text-[#b45534]">You declined this settlement</p>
            </div>
          )}
        </div>
      )}

      {/* Phase indicator */}
      <div className="mx-4 mt-3">
        <AnimatePresence mode="wait">
          {phase === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="border border-[#c4893b]/30 p-3 flex items-center gap-3">
              <Loader2 className="h-4 w-4 text-[#c4893b] animate-spin flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-[#c4893b]">Settlement In Progress</p>
                <p className="text-[9px] font-mono text-[#8a7e72]">XRPL consensus</p>
              </div>
            </motion.div>
          )}
          {phase === "complete" && (
            <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="border border-[#6b7c5e]/30 p-3 flex items-center gap-3">
              <CheckCircle className="h-4 w-4 text-[#6b7c5e] flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-[#6b7c5e]">All Settled</p>
                <p className="text-[9px] font-mono text-[#8a7e72]">Payments confirmed on-chain</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Transactions */}
      <div className="flex-1 px-4 pt-3 pb-4 space-y-2">
        <p className="text-[9px] font-mono text-[#8a7e72] uppercase tracking-widest mb-1">
          {myObligations.length > 0 ? `Activity (${myObligations.length})` : "No pending transfers"}
        </p>
        {myObligations.map((o, i) => {
          const isSender = o.from === participantId;
          const otherName = isSender ? (o.toName || getName(o.to)) : (o.fromName || getName(o.from));
          const otherIdx = isSender ? (trip.participants.findIndex((p) => p.id === o.to)) : (trip.participants.findIndex((p) => p.id === o.from));
          const isConfirmed = o.status === "confirmed";
          const isFailed = o.status === "failed";

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: isSender ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="border border-[#2e2b29] p-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#1c1a19] flex items-center justify-center font-mono font-bold text-base flex-shrink-0"
                  style={{ borderLeft: `3px solid ${ACCENT_COLORS[otherIdx % ACCENT_COLORS.length]}` }}>
                  {otherName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {isSender ? (
                      <ArrowUpRight className="h-3 w-3 text-[#b45534] flex-shrink-0" />
                    ) : (
                      <ArrowDownLeft className="h-3 w-3 text-[#6b7c5e] flex-shrink-0" />
                    )}
                    <span className="text-xs font-semibold">{isSender ? `To ${otherName}` : `From ${otherName}`}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {isConfirmed ? (
                      <CheckCircle className="h-2.5 w-2.5 text-[#6b7c5e]" />
                    ) : isFailed ? (
                      <XCircle className="h-2.5 w-2.5 text-[#b45534]" />
                    ) : phase === "processing" ? (
                      <Loader2 className="h-2.5 w-2.5 text-[#c4893b] animate-spin" />
                    ) : null}
                    <span className="text-[8px] font-mono" style={{
                      color: isConfirmed ? "#6b7c5e" : isFailed ? "#b45534" : "#8a7e72"
                    }}>
                      {isConfirmed ? "CONFIRMED" : isFailed ? "FAILED" : phase === "processing" ? "PROCESSING" : "PENDING"}
                    </span>
                  </div>
                </div>
                <p className="font-mono font-bold text-base flex-shrink-0" style={{
                  color: isSender ? "#b45534" : "#6b7c5e"
                }}>
                  {isSender ? "-" : "+"}${o.rlusdAmount.toFixed(2)}
                </p>
              </div>
              {o.txHash && (
                <p className="text-[7px] font-mono text-[#8a7e72] mt-1.5 truncate">{o.txHash}</p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Personal receipt CID */}
      {myReceiptCid && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="mx-4 mb-3 border border-[#c4893b]/20 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-[#c4893b]" />
            <p className="text-[9px] font-mono text-[#c4893b] uppercase tracking-widest">Your Settlement Receipt</p>
          </div>
          <p className="text-[8px] font-mono text-[#8a7e72] truncate">{myReceiptCid}</p>
          <a
            href={`https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY || "gateway.pinata.cloud"}/ipfs/${myReceiptCid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[9px] font-mono text-[#c4893b] hover:opacity-80"
          >
            View on IPFS <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </motion.div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#2e2b29] flex items-center justify-between text-[9px] font-mono text-[#8a7e72]">
        <span>{trip.name}</span>
        <span>{phase === "idle" ? "WAITING" : phase === "processing" ? "SETTLING" : "DONE"}</span>
      </div>
    </div>
  );
}
