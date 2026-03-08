"use client";

import { use, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trip, LiveObligation } from "@/lib/types";
import { minimizeDebts } from "@/lib/splits";
import { CheckCircle, Loader2, XCircle, ExternalLink, Wifi, WifiOff, Zap, ArrowDown, ArrowUp } from "lucide-react";

const CONSENSUS_STEPS = [
  { label: "Submitted to network", step: "01" },
  { label: "Propagating to validators", step: "02" },
  { label: "Validators reaching 80%+ consensus", step: "03" },
  { label: "Ledger closed — confirmed", step: "04" },
];

const ACCENT_COLORS = ["#b45534", "#6b7c5e", "#c2b59b", "#c4893b", "#8a7e72"];

type WalletBalance = { address: string; xrp: string };

export default function LivePage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [connected, setConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [balances, setBalances] = useState<Map<string, WalletBalance>>(new Map());
  const [prevBalances, setPrevBalances] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}`);
        if (res.ok) {
          const data: Trip = await res.json();
          if (active) { setTrip(data); setConnected(true); setLastUpdated(new Date()); }
        }
      } catch {
        if (active) setConnected(false);
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => { active = false; clearInterval(id); };
  }, [tripId]);

  // Poll wallet balances
  useEffect(() => {
    if (!trip) return;
    let active = true;
    const pollBalances = async () => {
      for (const p of trip.participants) {
        if (!p.wallet?.address) continue;
        try {
          const res = await fetch(`/api/balances?address=${p.wallet.address}`);
          if (res.ok && active) {
            const data = await res.json();
            setBalances((prev) => {
              const next = new Map(prev);
              const old = prev.get(p.id);
              if (old) {
                setPrevBalances((pb) => new Map(pb).set(p.id, old.xrp));
              }
              next.set(p.id, { address: p.wallet.address, xrp: data.xrp });
              return next;
            });
          }
        } catch {}
      }
    };
    pollBalances();
    const id = setInterval(pollBalances, 5000);
    return () => { active = false; clearInterval(id); };
  }, [trip?.participants.map((p) => p.wallet?.address).join(",")]);

  const phase = trip?.settlementStatus?.phase ?? "idle";
  const liveObligations: LiveObligation[] = trip?.settlementStatus?.obligations ?? [];
  const pendingObligations = trip ? minimizeDebts(trip.expenses, trip.participants) : [];
  const obligations: LiveObligation[] = liveObligations.length > 0 ? liveObligations : (pendingObligations as LiveObligation[]);

  const getName = (id: string) => trip?.participants.find((p) => p.id === id)?.name ?? "Unknown";
  const getInitial = (id: string) => (trip?.participants.find((p) => p.id === id)?.name ?? "?").charAt(0).toUpperCase();
  const getIdx = (id: string) => trip?.participants.findIndex((p) => p.id === id) ?? 0;

  const totalSettled = obligations.reduce((s, o) => o.status === "confirmed" ? s + o.rlusdAmount : s, 0);
  const totalPending = obligations.reduce((s, o) => s + o.rlusdAmount, 0);

  return (
    <div className="min-h-screen bg-[#0a0a09] text-[#e8e2d9] p-4 sm:p-6 md:p-10 flex flex-col gap-4 sm:gap-6 md:gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#c4893b]" />
            <span className="text-[9px] sm:text-[10px] font-mono text-[#c4893b] uppercase tracking-[0.3em]">TrustTab Live</span>
          </div>
          <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight truncate">{trip?.name ?? "Loading..."}</h1>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            {connected ? (
              <><Wifi className="h-3.5 w-3.5 text-[#6b7c5e]" /><span className="text-[#6b7c5e]">LIVE</span></>
            ) : (
              <><WifiOff className="h-3.5 w-3.5 text-[#b45534]" /><span className="text-[#b45534]">OFFLINE</span></>
            )}
          </div>
          <span className="text-[9px] font-mono text-[#8a7e72]">{lastUpdated.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Wallet Balances - mobile cards */}
      {trip && (
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
          {trip.participants.map((p, i) => {
            const bal = balances.get(p.id);
            const prev = prevBalances.get(p.id);
            const changed = bal && prev && bal.xrp !== prev;
            const increased = changed && parseFloat(bal.xrp) > parseFloat(prev);
            const decreased = changed && parseFloat(bal.xrp) < parseFloat(prev);

            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="border border-[#2e2b29] p-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#1c1a19] flex items-center justify-center font-mono font-bold text-sm sm:text-lg flex-shrink-0"
                    style={{ borderLeft: `3px solid ${ACCENT_COLORS[i % ACCENT_COLORS.length]}` }}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs sm:text-sm">{p.name}</p>
                    {p.wallet.address ? (
                      <p className="text-[8px] sm:text-[9px] font-mono text-[#6b7c5e] truncate">{p.wallet.address.slice(0, 6)}...{p.wallet.address.slice(-4)}</p>
                    ) : (
                      <p className="text-[8px] sm:text-[9px] font-mono text-[#8a7e72]">No wallet</p>
                    )}
                  </div>
                </div>
                {bal && (
                  <motion.div
                    className="flex items-center gap-1 sm:ml-auto"
                    animate={changed ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ duration: 0.4 }}
                  >
                    <span className="font-mono font-bold text-sm sm:text-base" style={{
                      color: increased ? "#6b7c5e" : decreased ? "#b45534" : "#c2b59b",
                    }}>
                      {parseFloat(bal.xrp).toFixed(1)}
                    </span>
                    <span className="text-[8px] font-mono text-[#8a7e72]">XRP</span>
                    {increased && <ArrowUp className="h-3 w-3 text-[#6b7c5e]" />}
                    {decreased && <ArrowDown className="h-3 w-3 text-[#b45534]" />}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Settlement total */}
      {obligations.length > 0 && (
        <div className="flex items-center gap-4 sm:gap-6 border border-[#2e2b29] p-3 sm:p-4">
          <div>
            <p className="text-[9px] font-mono text-[#8a7e72] uppercase tracking-widest">Total</p>
            <p className="font-mono font-bold text-lg sm:text-2xl text-[#c2b59b]">${totalPending.toFixed(2)}</p>
          </div>
          <div className="w-px h-8 bg-[#2e2b29]" />
          <div>
            <p className="text-[9px] font-mono text-[#8a7e72] uppercase tracking-widest">Confirmed</p>
            <p className="font-mono font-bold text-lg sm:text-2xl text-[#6b7c5e]">${totalSettled.toFixed(2)}</p>
          </div>
          <div className="w-px h-8 bg-[#2e2b29]" />
          <div>
            <p className="text-[9px] font-mono text-[#8a7e72] uppercase tracking-widest">Transfers</p>
            <p className="font-mono font-bold text-lg sm:text-2xl text-[#e8e2d9]">{obligations.length}</p>
          </div>
        </div>
      )}

      {/* Phase */}
      <AnimatePresence mode="wait">
        {phase === "processing" && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="border border-[#c4893b]/20 p-4 sm:p-6">
            <p className="text-[10px] font-mono text-[#c4893b] uppercase tracking-[0.3em] mb-4 sm:mb-5">XRPL Consensus</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {CONSENSUS_STEPS.map((step, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.5 }} className="space-y-2">
                  <span className="text-[10px] font-mono text-[#c4893b]">{step.step}</span>
                  <div className="h-px bg-[#2e2b29] overflow-hidden">
                    <motion.div className="h-full bg-[#c4893b]" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ delay: i * 0.5 + 0.2, duration: 0.5 }} />
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-[#8a7e72] leading-tight">{step.label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {phase === "complete" && (
          <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="border border-[#6b7c5e]/30 p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-[#6b7c5e]" />
              <div>
                <p className="text-base sm:text-lg font-bold text-[#6b7c5e]">Settlement Complete</p>
                <p className="text-[10px] sm:text-xs text-[#8a7e72]">All payments confirmed on XRPL</p>
              </div>
            </div>
          </motion.div>
        )}

        {phase === "idle" && obligations.length > 0 && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="border border-[#2e2b29] p-4 sm:p-5">
            <p className="text-[10px] font-mono text-[#8a7e72] uppercase tracking-widest">Waiting for settlement</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transactions */}
      {obligations.length > 0 && (
        <div className="space-y-2 sm:space-y-3">
          <p className="text-[10px] font-mono text-[#8a7e72] uppercase tracking-widest">
            Transfers ({obligations.length})
          </p>
          {obligations.map((o, i) => {
            const fromName = o.fromName || getName(o.from);
            const toName = o.toName || getName(o.to);
            const fromAddr = o.fromAddress || trip?.participants.find(p => p.id === o.from)?.wallet.address;
            const toAddr = o.toAddress || trip?.participants.find(p => p.id === o.to)?.wallet.address;
            const explorerUrl = o.explorerUrl;
            const isConfirmed = o.status === "confirmed";
            const isFailed = o.status === "failed";
            const isPending = !isConfirmed && !isFailed;

            return (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="border border-[#2e2b29] p-3 sm:p-5 md:p-6">
                {/* Mobile: stacked layout, Desktop: horizontal */}
                <div className="flex items-center gap-3 sm:gap-4 md:gap-8">
                  {/* Sender */}
                  <div className="flex flex-col items-center gap-1 sm:gap-2 w-14 sm:w-20 flex-shrink-0">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-[#1c1a19] flex items-center justify-center font-mono font-bold text-xl sm:text-3xl md:text-4xl"
                      style={{ borderLeft: `3px solid ${ACCENT_COLORS[getIdx(o.from) % ACCENT_COLORS.length]}` }}>
                      {getInitial(o.from)}
                    </div>
                    <span className="font-bold text-[10px] sm:text-xs md:text-sm">{fromName}</span>
                    {fromAddr && <span className="text-[7px] sm:text-[8px] md:text-[9px] font-mono text-[#6b7c5e] hidden sm:block">{fromAddr.slice(0, 6)}...{fromAddr.slice(-4)}</span>}
                  </div>

                  {/* Track */}
                  <div className="flex-1 relative h-12 sm:h-16 md:h-20 flex items-center">
                    <div className="w-full h-px bg-[#2e2b29]" />
                    {[0, 1, 2].map((ci) => (
                      <motion.span key={ci} className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 md:w-3 md:h-3 bg-[#c2b59b] pointer-events-none"
                        style={{ left: 0 }}
                        initial={{ x: "0%", opacity: 0 }}
                        animate={phase !== "idle" ? { x: ["0%", "95%"], opacity: [0, 1, 1, 0] } : { opacity: 0 }}
                        transition={{ duration: 1.3, delay: i * 0.2 + ci * 0.25, repeat: phase === "processing" ? Infinity : 0, repeatDelay: 1.0, ease: "linear" }}
                      />
                    ))}
                    <div className="absolute inset-0 flex items-end justify-center">
                      <span className="bg-[#0a0a09] px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm md:text-base font-mono font-bold text-[#c2b59b] border border-[#2e2b29]">
                        ${o.rlusdAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Receiver */}
                  <div className="flex flex-col items-center gap-1 sm:gap-2 w-14 sm:w-20 flex-shrink-0">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-[#1c1a19] flex items-center justify-center font-mono font-bold text-xl sm:text-3xl md:text-4xl"
                      style={{ borderLeft: `3px solid ${ACCENT_COLORS[getIdx(o.to) % ACCENT_COLORS.length]}` }}>
                      {getInitial(o.to)}
                    </div>
                    <span className="font-bold text-[10px] sm:text-xs md:text-sm">{toName}</span>
                    {toAddr && <span className="text-[7px] sm:text-[8px] md:text-[9px] font-mono text-[#6b7c5e] hidden sm:block">{toAddr.slice(0, 6)}...{toAddr.slice(-4)}</span>}
                  </div>
                </div>

                <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-[#2e2b29] flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {isConfirmed ? (
                      <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#6b7c5e]" />
                    ) : isFailed ? (
                      <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#b45534]" />
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#c4893b] animate-spin" />
                    )}
                    <span className="font-mono text-[9px] sm:text-[10px]" style={{ color: isConfirmed ? "#6b7c5e" : isFailed ? "#b45534" : "#c4893b" }}>
                      {isConfirmed ? "CONFIRMED" : isFailed ? "FAILED" : isPending && phase === "processing" ? "PROCESSING" : "PENDING"}
                    </span>
                  </div>
                  {o.txHash && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[8px] sm:text-[10px] text-[#8a7e72] hidden sm:inline">{o.txHash.slice(0, 10)}...</span>
                      {explorerUrl && (
                        <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[#b45534] hover:opacity-80 flex items-center gap-1 text-[9px] sm:text-[10px] font-mono">
                          Explorer <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto pt-4 sm:pt-6 border-t border-[#2e2b29] flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-[#8a7e72]">
        <span>TrustTab / XRPL + Pinata + GPT-4o</span>
        <span>{phase === "idle" ? "WAITING" : phase === "processing" ? "SETTLING" : "DONE"}</span>
      </div>
    </div>
  );
}
