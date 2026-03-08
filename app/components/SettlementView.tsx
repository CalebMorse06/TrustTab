"use client";

import { useState, useEffect } from "react";
import { Trip, Obligation } from "@/lib/types";
import { minimizeDebts } from "@/lib/splits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, Zap, Loader2, ArrowRight, Monitor, AlertTriangle, Copy, Check, Smartphone, ShieldCheck, FileText, ExternalLink } from "lucide-react";
import { SettlementAnimation } from "./SettlementAnimation";

type EnrichedObligation = Obligation & {
  fromName?: string;
  toName?: string;
  fromAddress?: string;
  toAddress?: string;
  explorerUrl?: string;
};

type WalletResult = {
  participantId: string;
  name: string;
  address: string;
  funded: boolean;
  xrpBalance?: number;
};

export function SettlementView({ trip }: { trip: Trip }) {
  const [walletsReady, setWalletsReady] = useState(
    trip.participants.every((p) => p.wallet.address)
  );
  const [generatingWallets, setGeneratingWallets] = useState(false);
  const [walletResults, setWalletResults] = useState<WalletResult[]>([]);
  const [consentStep, setConsentStep] = useState(false);
  const [settling, setSettling] = useState(false);
  const [phase, setPhase] = useState<"idle" | "processing" | "complete">("idle");
  const [results, setResults] = useState<EnrichedObligation[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<Record<string, { approved: boolean; timestamp: string }>>(trip.approvals || {});
  const [generatingAudit, setGeneratingAudit] = useState(false);
  const [auditCid, setAuditCid] = useState<string | null>(trip.settlementStatus?.auditCid || null);
  const [participantCids, setParticipantCids] = useState<Record<string, string>>(trip.settlementStatus?.participantCids || {});

  const obligations = minimizeDebts(trip.expenses, trip.participants);
  const getName = (id: string) =>
    trip.participants.find((p) => p.id === id)?.name || "Unknown";

  const liveUrl = typeof window !== "undefined"
    ? `${window.location.origin}/live/${trip.id}`
    : `/live/${trip.id}`;

  const allApproved = trip.participants.every((p) => approvals[p.id]?.approved);
  const approvalCount = trip.participants.filter((p) => approvals[p.id]?.approved).length;

  // Poll approvals
  useEffect(() => {
    if (phase !== "idle" || allApproved) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/trips/${trip.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.approvals) setApprovals(data.approvals);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(id);
  }, [trip.id, phase, allApproved]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const generateWallets = async () => {
    setGeneratingWallets(true);
    try {
      const res = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id }),
      });
      const data = await res.json();
      setWalletResults(data.wallets || []);
      if (data.allFunded) setWalletsReady(true);
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingWallets(false);
    }
  };

  const settle = async () => {
    setConsentStep(false);
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

  const generateAuditReport = async () => {
    setGeneratingAudit(true);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: trip.id }),
      });
      const data = await res.json();
      if (data.auditCid) setAuditCid(data.auditCid);
      if (data.participantCids) setParticipantCids(data.participantCids);
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingAudit(false);
    }
  };

  if (obligations.length === 0) {
    return (
      <Card className="surface">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No debts to settle. Everyone is even.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live view link */}
      <div className="flex items-center gap-3 border border-border px-4 py-3">
        <Monitor className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Second Screen</p>
          <p className="text-[11px] font-mono text-muted-foreground truncate">{liveUrl}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => copyToClipboard(liveUrl, "live")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied === "live" ? <Check className="h-3.5 w-3.5 text-[#6b7c5e]" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono border border-border px-3 py-1 text-muted-foreground hover:bg-secondary transition-colors"
          >
            OPEN
          </a>
        </div>
      </div>

      {/* Per-participant wallet views for phones */}
      <div className="border border-border px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Phone Wallet Views</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {trip.participants.map((p, i) => {
            const walletUrl = typeof window !== "undefined"
              ? `${window.location.origin}/wallet/${trip.id}/${p.id}`
              : `/wallet/${trip.id}/${p.id}`;
            const hasApproved = approvals[p.id]?.approved;
            return (
              <div key={p.id} className="flex items-center gap-2 border px-3 py-2"
                style={{ borderColor: hasApproved ? "rgba(107,124,94,0.3)" : undefined }}>
                <div
                  className="w-6 h-6 bg-secondary flex items-center justify-center text-[10px] font-mono font-bold flex-shrink-0"
                  style={{ borderLeft: `2px solid ${["#b45534","#6b7c5e","#c2b59b","#c4893b","#8a7e72"][i % 5]}` }}
                >
                  {p.name.charAt(0)}
                </div>
                <span className="text-[10px] font-mono truncate flex-1">{p.name}</span>
                {hasApproved && <ShieldCheck className="h-3 w-3 text-[#6b7c5e] flex-shrink-0" />}
                <button
                  onClick={() => copyToClipboard(walletUrl, `wallet-${p.id}`)}
                  className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                >
                  {copied === `wallet-${p.id}` ? <Check className="h-3 w-3 text-[#6b7c5e]" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <Card className="surface">
        <CardContent className="p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#c4893b]" />
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Settlement</p>
          </div>

          {/* Step 1: Generate wallets */}
          {!walletsReady && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Each participant gets an XRPL testnet wallet funded with 100 XRP.
              </p>
              <p className="text-[10px] font-mono text-[#c4893b]">
                Demo: wallets are server-generated. Production would use Xaman.
              </p>
              <Button
                onClick={generateWallets}
                disabled={generatingWallets}
                className="bg-[#b45534] hover:bg-[#9a4529] text-white border-0"
              >
                {generatingWallets ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
                ) : (
                  <><Wallet className="mr-2 h-4 w-4" />Generate Wallets</>
                )}
              </Button>
            </div>
          )}

          {/* Wallet addresses */}
          {walletResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                Wallets Assigned
              </p>
              {walletResults.map((w, i) => (
                <div key={w.participantId} className="flex items-center gap-3 border border-border px-3 py-2">
                  <div
                    className="w-7 h-7 bg-secondary flex items-center justify-center text-[11px] font-mono font-bold"
                    style={{ borderLeft: `2px solid ${["#b45534","#6b7c5e","#c2b59b","#c4893b","#8a7e72"][i % 5]}` }}
                  >
                    {w.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">{w.name}</p>
                    <p className="text-[9px] font-mono text-muted-foreground truncate">{w.address}</p>
                  </div>
                  <span className="text-[10px] font-mono text-[#6b7c5e]">{w.xrpBalance ?? 100} XRP</span>
                  <button onClick={() => copyToClipboard(w.address, w.participantId)} className="text-muted-foreground hover:text-foreground">
                    {copied === w.participantId ? <Check className="h-3 w-3 text-[#6b7c5e]" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Approval status */}
          {walletsReady && phase === "idle" && (
            <div className="border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#c4893b]" />
                <p className="text-[10px] font-mono text-[#c4893b] uppercase tracking-widest">Participant Consent</p>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                  {approvalCount}/{trip.participants.length}
                </span>
              </div>
              <div className="space-y-1">
                {trip.participants.map((p, i) => {
                  const approved = approvals[p.id]?.approved;
                  return (
                    <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 border border-border">
                      <div className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: approved ? "#6b7c5e" : "#2e2b29" }} />
                      <span className="text-xs flex-1">{p.name}</span>
                      <span className="text-[9px] font-mono" style={{ color: approved ? "#6b7c5e" : "#8a7e72" }}>
                        {approved ? "APPROVED" : "WAITING"}
                      </span>
                    </div>
                  );
                })}
              </div>
              {!allApproved && (
                <p className="text-[10px] text-muted-foreground">
                  Have each participant open their wallet view on their phone and tap Approve.
                </p>
              )}
            </div>
          )}

          {/* Step 2: Review — only when all approved */}
          {walletsReady && phase === "idle" && !consentStep && allApproved && (
            <div className="space-y-3">
              <div className="border border-[#6b7c5e]/20 p-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#6b7c5e]" />
                <p className="text-xs text-[#6b7c5e] font-semibold">All participants approved</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {obligations.length} transfer{obligations.length !== 1 ? "s" : ""} needed.
              </p>
              <div className="space-y-1">
                {obligations.map((o, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm border border-border px-3 py-2">
                    <span className="font-mono text-xs font-bold" style={{ color: "#b45534" }}>
                      {getName(o.from).charAt(0)}
                    </span>
                    <span className="text-xs">{getName(o.from)}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono text-xs font-bold" style={{ color: "#6b7c5e" }}>
                      {getName(o.to).charAt(0)}
                    </span>
                    <span className="text-xs">{getName(o.to)}</span>
                    <span className="ml-auto font-mono font-bold text-xs text-[#c2b59b]">
                      ${o.rlusdAmount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => setConsentStep(true)}
                className="bg-[#b45534] hover:bg-[#9a4529] text-white border-0 font-semibold"
                size="lg"
              >
                <Zap className="mr-2 h-4 w-4" />
                Review and Settle
              </Button>
            </div>
          )}

          {/* Consent */}
          {consentStep && phase === "idle" && (
            <div className="space-y-4 border border-[#c4893b]/30 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-[#c4893b] flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-sm">Confirm Settlement</p>
                  <p className="text-xs text-muted-foreground">
                    XRP payments will be sent on XRPL testnet. Transactions are
                    irreversible. Each includes a cryptographic receipt memo.
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                {obligations.map((o, i) => (
                  <div key={i} className="text-xs border border-border p-3 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span>{getName(o.from)}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span>{getName(o.to)}</span>
                      <span className="ml-auto text-[#c2b59b] font-mono">${o.rlusdAmount.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={settle}
                  disabled={settling}
                  className="bg-[#b45534] hover:bg-[#9a4529] text-white border-0 font-semibold flex-1"
                >
                  Confirm and Send
                </Button>
                <Button variant="ghost" onClick={() => setConsentStep(false)} className="text-muted-foreground">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Results */}
          {phase !== "idle" && (
            <SettlementAnimation
              obligations={results.length > 0 ? results : obligations}
              participants={trip.participants}
              getName={getName}
              phase={phase}
            />
          )}

          {/* Generate audit report after settlement */}
          {phase === "complete" && !auditCid && (
            <Button
              onClick={generateAuditReport}
              disabled={generatingAudit}
              className="w-full bg-[#1c1a19] hover:bg-[#252321] text-[#c4893b] border border-[#c4893b]/30 font-semibold"
            >
              {generatingAudit ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Pinning audit to IPFS...</>
              ) : (
                <><FileText className="mr-2 h-4 w-4" />Generate Audit Report</>
              )}
            </Button>
          )}

          {/* Audit report CIDs */}
          {auditCid && (
            <div className="border border-[#c4893b]/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#c4893b]" />
                <p className="text-[10px] font-mono text-[#c4893b] uppercase tracking-widest">IPFS Audit Trail</p>
              </div>

              <div className="border border-border p-3 space-y-1">
                <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Master Audit Report</p>
                <p className="text-[10px] font-mono text-foreground truncate">{auditCid}</p>
              </div>

              {Object.keys(participantCids).length > 0 && (
                <div className="space-y-1">
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Personal Receipts</p>
                  {trip.participants.map((p, i) => {
                    const cid = participantCids[p.id];
                    if (!cid) return null;
                    return (
                      <div key={p.id} className="flex items-center gap-2 border border-border px-3 py-2">
                        <div className="w-5 h-5 bg-secondary flex items-center justify-center text-[9px] font-mono font-bold flex-shrink-0"
                          style={{ borderLeft: `2px solid ${["#b45534","#6b7c5e","#c2b59b","#c4893b","#8a7e72"][i % 5]}` }}>
                          {p.name.charAt(0)}
                        </div>
                        <span className="text-[10px] font-mono truncate flex-1">{cid}</span>
                        <button onClick={() => copyToClipboard(cid, `cid-${p.id}`)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                          {copied === `cid-${p.id}` ? <Check className="h-3 w-3 text-[#6b7c5e]" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
