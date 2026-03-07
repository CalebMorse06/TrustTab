"use client";

import { useState } from "react";
import { Trip, Obligation } from "@/lib/types";
import { minimizeDebts } from "@/lib/splits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Zap, Loader2 } from "lucide-react";
import { SettlementAnimation } from "./SettlementAnimation";

type EnrichedObligation = Obligation & {
  fromName?: string;
  toName?: string;
  explorerUrl?: string;
};

export function SettlementView({ trip }: { trip: Trip }) {
  const [walletsReady, setWalletsReady] = useState(
    trip.participants.every((p) => p.wallet.address)
  );
  const [generatingWallets, setGeneratingWallets] = useState(false);
  const [settling, setSettling] = useState(false);
  const [phase, setPhase] = useState<"idle" | "processing" | "complete">("idle");
  const [results, setResults] = useState<EnrichedObligation[]>([]);

  const obligations = minimizeDebts(trip.expenses, trip.participants);
  const getName = (id: string) =>
    trip.participants.find((p) => p.id === id)?.name || "Unknown";

  const generateWallets = async () => {
    setGeneratingWallets(true);
    try {
      const res = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id }),
      });
      const data = await res.json();
      if (data.allFunded) {
        setWalletsReady(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingWallets(false);
    }
  };

  const settle = async () => {
    setSettling(true);
    setPhase("processing");
    try {
      const res = await fetch("/api/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id }),
      });
      const data = await res.json();
      setResults(data.obligations || []);
      setPhase("complete");
    } catch (e) {
      console.error(e);
      setPhase("idle");
    } finally {
      setSettling(false);
    }
  };

  if (obligations.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="py-8 text-center text-muted-foreground">
          No debts to settle. Everyone is even!
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-[#f59e0b]" />
          Settlement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1: Generate wallets */}
        {!walletsReady && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              First, generate XRPL testnet wallets for all participants.
            </p>
            <Button
              onClick={generateWallets}
              disabled={generatingWallets}
              className="gradient-emerald text-white border-0"
            >
              {generatingWallets ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Wallets...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Generate XRPL Wallets
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step 2: Settle */}
        {walletsReady && phase === "idle" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {obligations.length} RLUSD transfer
              {obligations.length !== 1 ? "s" : ""} needed to settle all debts.
            </p>
            <Button
              onClick={settle}
              disabled={settling}
              className="gradient-gold text-[#0a0e27] border-0 font-bold"
              size="lg"
            >
              <Zap className="mr-2 h-5 w-5" />
              Settle Now on XRPL
            </Button>
          </div>
        )}

        {/* Animation + Results */}
        {phase !== "idle" && (
          <SettlementAnimation
            obligations={results.length > 0 ? results : obligations}
            getName={getName}
            phase={phase}
          />
        )}
      </CardContent>
    </Card>
  );
}
