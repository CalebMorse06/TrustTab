"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export function NetworkStatus() {
  const [connected, setConnected] = useState(false);
  const [ledgerIndex, setLedgerIndex] = useState<number | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/network");
        if (res.ok) {
          const data = await res.json();
          setConnected(data.connected);
          setLedgerIndex(data.ledgerIndex);
        }
      } catch {
        setConnected(false);
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <motion.div
          className={`w-1.5 h-1.5 ${connected ? "bg-[#6b7c5e]" : "bg-[#b45534]"}`}
          animate={connected ? { opacity: [1, 0.3, 1] } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
        />
        <span>{connected ? "XRPL TESTNET" : "DISCONNECTED"}</span>
      </div>
      {ledgerIndex && (
        <span className="text-muted-foreground/50">#{ledgerIndex.toLocaleString()}</span>
      )}
    </div>
  );
}
