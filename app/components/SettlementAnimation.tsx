"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Obligation, Participant } from "@/lib/types";
import { CheckCircle, Loader2, XCircle, ExternalLink } from "lucide-react";

const CONSENSUS_STEPS = [
  { label: "Submitting to XRPL network", step: "01" },
  { label: "Propagating to validators", step: "02" },
  { label: "Validators reaching consensus (80%+)", step: "03" },
  { label: "Ledger closing and confirming", step: "04" },
];

const ACCENT_COLORS = ["#b45534", "#6b7c5e", "#c2b59b", "#c4893b", "#8a7e72"];

export function SettlementAnimation({
  obligations,
  participants,
  getName,
  phase,
}: {
  obligations: (Obligation & {
    fromName?: string;
    toName?: string;
    fromAddress?: string;
    toAddress?: string;
    explorerUrl?: string;
  })[];
  participants?: Participant[];
  getName: (id: string) => string;
  phase: "idle" | "processing" | "complete";
}) {
  const getInitial = (id: string) => {
    const p = participants?.find((p) => p.id === id);
    return p ? p.name.charAt(0).toUpperCase() : "?";
  };

  const getIdx = (id: string) => participants?.findIndex((p) => p.id === id) ?? 0;

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {phase === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border border-[#c4893b]/20 p-4 space-y-3"
          >
            <p className="text-[10px] font-mono text-[#c4893b] uppercase tracking-[0.2em]">
              XRPL Consensus
            </p>
            {CONSENSUS_STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.7 }}
                className="space-y-1"
              >
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-[10px] font-mono text-muted-foreground w-4">{step.step}</span>
                  <span className="text-muted-foreground flex-1 text-xs">{step.label}</span>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.7 + 0.4 }}
                  >
                    <Loader2 className="h-3 w-3 animate-spin text-[#c4893b]" />
                  </motion.div>
                </div>
                <motion.div
                  className="h-px bg-border overflow-hidden ml-7"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.7 + 0.2 }}
                >
                  <motion.div
                    className="h-full bg-[#c4893b]"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ delay: i * 0.7 + 0.3, duration: 0.5 }}
                  />
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {phase === "complete" && (
          <motion.div
            key="complete"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border border-[#6b7c5e]/30 p-6"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-[#6b7c5e]" />
              <div>
                <p className="font-bold text-[#6b7c5e]">Settlement Complete</p>
                <p className="text-xs text-muted-foreground">All payments confirmed on XRPL</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {obligations.map((o, i) => {
          const fromName = o.fromName || getName(o.from);
          const toName = o.toName || getName(o.to);
          const fromInitial = getInitial(o.from);
          const toInitial = getInitial(o.to);
          const fromColor = ACCENT_COLORS[getIdx(o.from) % ACCENT_COLORS.length];
          const toColor = ACCENT_COLORS[getIdx(o.to) % ACCENT_COLORS.length];
          const isConfirmed = o.status === "confirmed";
          const isFailed = o.status === "failed";

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.12 }}
              className="border border-border p-4"
            >
              <div className="flex items-center gap-4">
                {/* Sender */}
                <div className="flex flex-col items-center gap-1 w-16 flex-shrink-0">
                  <div
                    className="w-12 h-12 bg-secondary flex items-center justify-center font-mono font-bold text-lg"
                    style={{ borderLeft: `3px solid ${fromColor}` }}
                  >
                    {fromInitial}
                  </div>
                  <span className="text-[10px] font-semibold text-center">{fromName}</span>
                  {o.fromAddress && (
                    <span className="text-[8px] font-mono text-muted-foreground">
                      {o.fromAddress.slice(0, 5)}...{o.fromAddress.slice(-4)}
                    </span>
                  )}
                </div>

                {/* Track */}
                <div className="flex-1 relative h-12 flex items-center">
                  <div className="w-full h-px bg-border" />
                  {[0, 1, 2].map((ci) => (
                    <motion.span
                      key={ci}
                      className="absolute w-2 h-2 bg-[#c2b59b]"
                      style={{ left: 0 }}
                      initial={{ x: "0%", opacity: 0 }}
                      animate={
                        phase !== "idle"
                          ? { x: ["0%", "100%"], opacity: [0, 1, 1, 0] }
                          : { opacity: 0 }
                      }
                      transition={{
                        duration: 1.2,
                        delay: i * 0.15 + ci * 0.2,
                        repeat: phase === "processing" ? Infinity : 0,
                        repeatDelay: 1.0,
                        ease: "linear",
                      }}
                    />
                  ))}
                  <div className="absolute inset-0 flex items-end justify-center">
                    <span className="text-[11px] font-mono font-bold text-[#c2b59b] bg-background px-2">
                      ${o.rlusdAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Receiver */}
                <div className="flex flex-col items-center gap-1 w-16 flex-shrink-0">
                  <div
                    className="w-12 h-12 bg-secondary flex items-center justify-center font-mono font-bold text-lg"
                    style={{ borderLeft: `3px solid ${toColor}` }}
                  >
                    {toInitial}
                  </div>
                  <span className="text-[10px] font-semibold text-center">{toName}</span>
                  {o.toAddress && (
                    <span className="text-[8px] font-mono text-muted-foreground">
                      {o.toAddress.slice(0, 5)}...{o.toAddress.slice(-4)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border text-xs">
                <div className="flex items-center gap-1.5">
                  {isConfirmed ? (
                    <CheckCircle className="h-3.5 w-3.5 text-[#6b7c5e]" />
                  ) : isFailed ? (
                    <XCircle className="h-3.5 w-3.5 text-[#b45534]" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 text-[#c4893b] animate-spin" />
                  )}
                  <span
                    className="font-mono text-[10px]"
                    style={{ color: isConfirmed ? "#6b7c5e" : isFailed ? "#b45534" : "#c4893b" }}
                  >
                    {isConfirmed ? "CONFIRMED" : isFailed ? "FAILED" : "PENDING"}
                  </span>
                </div>
                {o.txHash && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-muted-foreground text-[10px]">
                      {o.txHash.slice(0, 8)}...
                    </span>
                    {o.explorerUrl && (
                      <a href={o.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[#b45534] hover:opacity-80">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
