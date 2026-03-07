"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Globe, Wifi } from "lucide-react";

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
    <div className="flex items-center gap-3 text-xs font-mono">
      <div className="flex items-center gap-1.5">
        <motion.div
          className={`w-2 h-2 rounded-full ${connected ? "bg-[#10b981]" : "bg-red-400"}`}
          animate={connected ? { opacity: [1, 0.4, 1] } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
        />
        <span className="text-muted-foreground">
          {connected ? "XRPL Testnet" : "Disconnected"}
        </span>
      </div>
      {ledgerIndex && (
        <div className="flex items-center gap-1 text-muted-foreground/60">
          <Globe className="h-3 w-3" />
          <span>Ledger #{ledgerIndex.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
