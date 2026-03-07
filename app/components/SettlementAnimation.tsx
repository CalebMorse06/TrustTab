"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Obligation } from "@/lib/types";
import { CheckCircle, Loader2, XCircle, ExternalLink } from "lucide-react";

export function SettlementAnimation({
  obligations,
  getName,
  phase,
}: {
  obligations: (Obligation & {
    fromName?: string;
    toName?: string;
    explorerUrl?: string;
  })[];
  getName: (id: string) => string;
  phase: "idle" | "processing" | "complete";
}) {
  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {phase === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-8"
          >
            {/* Coin animation */}
            <div className="relative h-24 flex items-center justify-center mb-4">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute text-4xl"
                  initial={{ y: 0, opacity: 0, scale: 0 }}
                  animate={{
                    y: [0, -30, -10],
                    opacity: [0, 1, 0.8],
                    scale: [0, 1.2, 1],
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 1.5,
                    delay: i * 0.3,
                    repeat: Infinity,
                    repeatDelay: 0.5,
                  }}
                  style={{ left: `${30 + i * 20}%` }}
                >
                  🪙
                </motion.div>
              ))}
            </div>
            <p className="text-lg font-semibold">
              Settling on XRPL...
            </p>
            <p className="text-sm text-muted-foreground">
              Sending RLUSD payments with receipt CIDs
            </p>
          </motion.div>
        )}

        {phase === "complete" && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1] }}
              transition={{ duration: 0.5 }}
              className="text-6xl mb-4"
            >
              ✅
            </motion.div>
            <h3 className="text-xl font-bold text-[#10b981]">
              Settlement Complete!
            </h3>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction list */}
      <div className="space-y-2">
        {obligations.map((o, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
            className="flex items-center gap-3 bg-background/50 rounded-lg px-4 py-3"
          >
            <div className="flex-shrink-0">
              {o.status === "confirmed" ? (
                <CheckCircle className="h-5 w-5 text-[#10b981]" />
              ) : o.status === "failed" ? (
                <XCircle className="h-5 w-5 text-red-400" />
              ) : (
                <Loader2 className="h-5 w-5 text-[#f59e0b] animate-spin" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {o.fromName || getName(o.from)} → {o.toName || getName(o.to)}
              </p>
              {o.txHash && (
                <p className="text-xs font-mono text-muted-foreground truncate">
                  {o.txHash}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-bold text-[#10b981]">
                ${o.rlusdAmount.toFixed(2)}
              </span>
              {o.explorerUrl && (
                <a
                  href={o.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#f59e0b] hover:text-[#f59e0b]/80"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
