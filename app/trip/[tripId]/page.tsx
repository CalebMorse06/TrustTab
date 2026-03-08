"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Trip, ReceiptArtifact, ExtractedReceipt } from "@/lib/types";
import { calculateBalances, minimizeDebts } from "@/lib/splits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NetworkStatus } from "@/app/components/NetworkStatus";
import {
  ArrowLeft, Upload, Zap, Receipt, CheckCircle, Loader2, XCircle,
  ExternalLink, AlertTriangle, ArrowRight, Wallet, Shield, FileCheck,
  Globe, Fingerprint, X,
} from "lucide-react";
import Link from "next/link";

type Phase = "dashboard" | "uploading" | "extracting" | "extracted" | "settling-wallets" | "settling-payments" | "settle-complete";

type EnrichedObligation = {
  from: string; to: string; amount: number; rlusdAmount: number;
  txHash?: string; status: string; fromName?: string; toName?: string; explorerUrl?: string;
  memo?: string; fromAddress?: string; toAddress?: string; currency?: string;
};

type WalletBalance = { address: string; xrp: string; rlusd: string; hasTrustline: boolean };

const ACCENT_COLORS = ["#b45534", "#6b7c5e", "#c2b59b", "#c4893b", "#8a7e72"];

function getParticipantPositions(count: number) {
  const positions: { x: number; y: number }[] = [];
  const radius = 140;
  const startAngle = Math.PI * 0.8;
  const endAngle = Math.PI * 0.2;
  for (let i = 0; i < count; i++) {
    const angle = count === 1 ? Math.PI / 2 : startAngle - (i / (count - 1)) * (startAngle - endAngle);
    positions.push({ x: Math.cos(angle) * radius + 200, y: -Math.sin(angle) * (radius * 0.6) + 110 });
  }
  return positions;
}

export default function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params);
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("dashboard");

  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedReceipt | null>(null);
  const [uploadedArtifact, setUploadedArtifact] = useState<ReceiptArtifact | null>(null);
  const [duplicate, setDuplicate] = useState<{ similarity: number; matchCid?: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");

  const [settleResults, setSettleResults] = useState<EnrichedObligation[]>([]);
  const [activePaymentIndex, setActivePaymentIndex] = useState(-1);
  const [flyingCoins, setFlyingCoins] = useState<{ from: number; to: number; amount: number; id: number }[]>([]);
  const coinIdRef = useRef(0);

  const [walletBalances, setWalletBalances] = useState<Map<string, WalletBalance>>(new Map());
  const [settlementMeta, setSettlementMeta] = useState<{ receiptCids?: string; currency?: string } | null>(null);

  const loadTrip = useCallback(() => {
    fetch(`/api/trips/${tripId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setTrip(data);
        if (data?.participants[0] && !paidBy) setPaidBy(data.participants[0].id);
        setLoading(false);
        if (data?.participants) {
          data.participants.forEach((p: any) => {
            if (p.wallet?.address) fetchBalance(p.wallet.address, p.id);
          });
        }
      })
      .catch(() => setLoading(false));
  }, [tripId, paidBy]);

  const fetchBalance = async (address: string, participantId: string) => {
    try {
      const res = await fetch(`/api/balances?address=${address}`);
      if (res.ok) {
        const data = await res.json();
        setWalletBalances((prev) => new Map(prev).set(participantId, data));
      }
    } catch {}
  };

  useEffect(() => { loadTrip(); }, [loadTrip]);

  if (loading || !trip) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  const getName = (id: string) => trip.participants.find((p) => p.id === id)?.name || "?";
  const getIdx = (id: string) => trip.participants.findIndex((p) => p.id === id);
  const balances = trip.expenses.length > 0 ? calculateBalances(trip.expenses, trip.participants) : [];
  const obligations = trip.expenses.length > 0 ? minimizeDebts(trip.expenses, trip.participants) : [];
  const totalExpenses = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const positions = getParticipantPositions(trip.participants.length);
  const walletsReady = trip.participants.every((p) => p.wallet?.address);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { setUploadError("Upload an image"); return; }
    setUploadError(null); setDuplicate(null); setExtractedData(null); setUploadedArtifact(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setPhase("uploading");
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.status === 409) { setDuplicate({ similarity: data.similarity, matchCid: data.matchCid }); setPhase("dashboard"); return; }
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setPhase("extracting");
      await new Promise((r) => setTimeout(r, 1000));
      setExtractedData(data.extractedData);
      setUploadedArtifact({ pinataCid: data.pinataCid, pinataFileId: data.pinataFileId, fileName: data.fileName, mimeType: data.mimeType, extractedData: data.extractedData, gatewayUrl: data.gatewayUrl });
      if (data.extractedData) {
        if (data.extractedData.vendor !== "Unknown") setDescription(data.extractedData.vendor);
        if (data.extractedData.total > 0) setAmount(data.extractedData.total.toString());
      } else {
        setUploadError("AI extraction failed — fill in details manually");
      }
      setPhase("extracted");
    } catch (e) { setUploadError(e instanceof Error ? e.message : "Upload failed"); setPhase("dashboard"); }
  };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); };

  const saveExpense = async () => {
    if (!description || !amount || !paidBy) return;
    await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId, paidBy, description, amount: parseFloat(amount), splitType: "equal", receipt: uploadedArtifact || null }) });
    setDescription(""); setAmount(""); setPreview(null); setExtractedData(null); setUploadedArtifact(null); setPhase("dashboard");
    loadTrip();
  };

  const startSettlement = async () => {
    // Check approvals
    const allApproved = trip.participants.every((p) => trip.approvals?.[p.id]?.approved);
    if (!allApproved) {
      setUploadError("All participants must approve before settling. Have them open their wallet view.");
      return;
    }

    if (!walletsReady) {
      setPhase("settling-wallets");
      try {
        const res = await fetch("/api/wallets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId }) });
        const data = await res.json();
        if (!data.allFunded) { setPhase("dashboard"); return; }
        loadTrip();
        await new Promise((r) => setTimeout(r, 1500));
      } catch { setPhase("dashboard"); return; }
    }

    setPhase("settling-payments");
    setActivePaymentIndex(0);

    try {
      const res = await fetch("/api/settle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId }) });
      const data = await res.json();
      const results: EnrichedObligation[] = data.obligations || [];
      setSettleResults(results);
      setSettlementMeta({ receiptCids: data.receiptCids, currency: "XRP" });

      for (let i = 0; i < results.length; i++) {
        setActivePaymentIndex(i);
        const ob = results[i];
        const fromIdx = getIdx(ob.from);
        const toIdx = getIdx(ob.to);
        for (let c = 0; c < 4; c++) {
          coinIdRef.current++;
          setFlyingCoins((prev) => [...prev, { from: fromIdx, to: toIdx, amount: ob.rlusdAmount, id: coinIdRef.current }]);
          await new Promise((r) => setTimeout(r, 150));
        }
        await new Promise((r) => setTimeout(r, 1200));
        setFlyingCoins([]);
      }

      await new Promise((r) => setTimeout(r, 500));
      setPhase("settle-complete");
      loadTrip();
    } catch { setPhase("dashboard"); }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground text-xs font-mono">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> All Trips
        </Link>
        <NetworkStatus />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{trip.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm font-mono">
            ${totalExpenses.toFixed(2)} total / {trip.expenses.length} expense{trip.expenses.length !== 1 ? "s" : ""}
          </p>
        </div>
        <span
          className="text-[10px] font-mono uppercase tracking-wider"
          style={{ color: trip.status === "settled" ? "#6b7c5e" : "#c4893b" }}
        >
          {trip.status === "settled" ? "SETTLED" : "ACTIVE"}
        </span>
      </div>

      {/* Participant network */}
      <div className="relative mx-auto" style={{ width: 400, height: 240 }}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 240">
          {obligations.map((o, i) => {
            const fromPos = positions[getIdx(o.from)];
            const toPos = positions[getIdx(o.to)];
            if (!fromPos || !toPos) return null;
            const isActive = phase === "settling-payments" && activePaymentIndex === i;
            const isDone = phase === "settle-complete";
            return (
              <g key={i}>
                <line x1={fromPos.x} y1={fromPos.y} x2={toPos.x} y2={toPos.y}
                  stroke={isActive ? "#c4893b" : isDone ? "#6b7c5e" : "#2e2b29"}
                  strokeWidth={isActive ? 2 : 1} strokeDasharray={isActive ? "none" : "4 3"} />
                <text x={(fromPos.x + toPos.x) / 2} y={(fromPos.y + toPos.y) / 2 - 8}
                  fill={isActive ? "#c4893b" : isDone ? "#6b7c5e" : "#8a7e72"}
                  fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                  ${o.amount.toFixed(2)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Flying markers */}
        <AnimatePresence>
          {flyingCoins.map((coin) => {
            const fromPos = positions[coin.from]; const toPos = positions[coin.to];
            if (!fromPos || !toPos) return null;
            return (
              <motion.div key={coin.id} className="absolute w-2 h-2 bg-[#c2b59b] pointer-events-none z-20"
                initial={{ x: fromPos.x - 4, y: fromPos.y - 4, scale: 0, opacity: 0 }}
                animate={{ x: toPos.x - 4, y: toPos.y - 4, scale: [0, 1, 0.8], opacity: [0, 1, 0] }}
                transition={{ duration: 0.9, ease: "easeInOut" }}
                onAnimationComplete={() => setFlyingCoins((prev) => prev.filter((c) => c.id !== coin.id))}
              />
            );
          })}
        </AnimatePresence>

        {/* Participant nodes */}
        {trip.participants.map((p, i) => {
          const pos = positions[i];
          const bal = balances.find((b) => b.participantId === p.id);
          const wb = walletBalances.get(p.id);
          const isSettled = phase === "settle-complete";
          const isActiveSender = phase === "settling-payments" && settleResults[activePaymentIndex]?.from === p.id;
          const isActiveReceiver = phase === "settling-payments" && settleResults[activePaymentIndex]?.to === p.id;
          const accentColor = ACCENT_COLORS[i % ACCENT_COLORS.length];

          return (
            <motion.div key={p.id} className="absolute flex flex-col items-center"
              style={{ left: pos.x - 40, top: pos.y - 40 }}
              animate={{ scale: isActiveSender || isActiveReceiver ? 1.1 : 1 }}
              transition={{ type: "spring", stiffness: 300 }}>
              <div className="relative">
                <motion.div
                  className="w-16 h-16 flex items-center justify-center font-mono font-bold text-2xl transition-colors"
                  style={{
                    borderLeft: `3px solid ${isSettled ? "#6b7c5e" : isActiveSender ? "#b45534" : isActiveReceiver ? "#6b7c5e" : accentColor}`,
                    backgroundColor: isSettled ? "rgba(107,124,94,0.08)" : isActiveSender ? "rgba(180,85,52,0.08)" : isActiveReceiver ? "rgba(107,124,94,0.08)" : "#252321",
                  }}>
                  {p.name.charAt(0).toUpperCase()}
                </motion.div>

                {bal && Math.abs(bal.amount) > 0.01 && !isSettled && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="absolute -bottom-1 -right-1 text-[9px] font-mono font-bold px-1 py-0.5 whitespace-nowrap"
                    style={{
                      backgroundColor: bal.amount > 0 ? "#6b7c5e" : "#b45534",
                      color: "#e8e2d9",
                    }}>
                    {bal.amount > 0 ? "+" : ""}${Math.abs(bal.amount).toFixed(0)}
                  </motion.div>
                )}

                {isSettled && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + i * 0.1 }} className="absolute -bottom-1 -right-1">
                    <CheckCircle className="h-4 w-4 text-[#6b7c5e]" />
                  </motion.div>
                )}
              </div>

              <span className="text-[10px] font-medium mt-1">{p.name}</span>

              {p.wallet?.address && (
                <div className="flex flex-col items-center mt-0.5">
                  <span className="text-[7px] font-mono text-muted-foreground/40">{p.wallet.address.slice(0, 8)}...</span>
                  {wb && (
                    <span className="text-[7px] font-mono text-muted-foreground/40">{Number(wb.xrp).toFixed(0)} XRP</span>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}

        {/* Center status */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <AnimatePresence mode="wait">
            {phase === "settling-wallets" && (
              <motion.div key="wallets" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                <Loader2 className="h-5 w-5 text-[#c4893b] animate-spin" />
                <span className="text-[9px] font-mono text-muted-foreground mt-1">Funding wallets</span>
              </motion.div>
            )}
            {phase === "settling-payments" && activePaymentIndex >= 0 && (
              <motion.div key="paying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                <Zap className="h-5 w-5 text-[#c4893b]" />
                <span className="text-[9px] font-mono text-[#c4893b] font-bold mt-1">{activePaymentIndex + 1}/{obligations.length}</span>
              </motion.div>
            )}
            {phase === "settle-complete" && (
              <motion.div key="done" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <CheckCircle className="h-6 w-6 text-[#6b7c5e]" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Upload zone */}
      <AnimatePresence mode="wait">
        {phase === "dashboard" && trip.status !== "settled" && (
          <motion.div key="dropzone" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <motion.div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              animate={{ borderColor: dragOver ? "#b45534" : "#2e2b29", backgroundColor: dragOver ? "rgba(180,85,52,0.03)" : "#1c1a19" }}
              className="border-2 border-dashed p-8 text-center cursor-pointer hover:border-[#b45534]/30 transition-all"
              onClick={() => document.getElementById("receipt-input")?.click()}>
              <input id="receipt-input" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <p className="font-semibold text-sm">Drop a receipt</p>
                <p className="text-xs text-muted-foreground font-mono">IPFS pin / AI extraction / auto-split</p>
              </div>
            </motion.div>
          </motion.div>
        )}

        {phase === "uploading" && (
          <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="surface">
              <CardContent className="py-8 flex flex-col items-center gap-4">
                <div className="relative">
                  {preview && <img src={preview} alt="" className="w-20 h-28 object-cover opacity-40" />}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-[#c4893b] animate-spin" />
                  </div>
                </div>
                <p className="font-semibold text-sm">Pinning to IPFS via Pinata</p>
                <p className="text-[10px] text-muted-foreground font-mono">Generating content-addressed CID</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {phase === "extracting" && (
          <motion.div key="extracting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="surface">
              <CardContent className="py-8 flex flex-col items-center gap-4">
                <Loader2 className="h-6 w-6 text-[#c2b59b] animate-spin" />
                <p className="font-semibold text-sm">AI reading your receipt</p>
                <p className="text-xs text-muted-foreground font-mono">GPT-4o Vision extracting line items</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {phase === "extracted" && extractedData && (
          <motion.div key="extracted" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {uploadedArtifact?.pinataCid && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-border px-4 py-2 flex items-center gap-3">
                <Fingerprint className="h-4 w-4 text-[#c4893b] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-mono text-[#c4893b] uppercase tracking-widest">IPFS CID</p>
                  <p className="text-[11px] font-mono text-foreground truncate">{uploadedArtifact.pinataCid}</p>
                </div>
                <span className="text-[9px] font-mono text-[#c4893b] border border-[#c4893b]/30 px-2 py-0.5">PINNED</span>
              </motion.div>
            )}

            <Card className="surface border-[#6b7c5e]/20 overflow-hidden">
              <CardContent className="py-0">
                <div className="flex gap-5">
                  {preview && (
                    <div className="w-28 flex-shrink-0 -ml-6">
                      <img src={preview} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 py-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-[#6b7c5e]" />
                      <span className="text-[10px] font-mono text-[#6b7c5e] uppercase tracking-widest">Extracted</span>
                    </div>
                    <p className="text-xl font-bold">{extractedData.vendor}</p>
                    <div className="space-y-0.5 text-xs">
                      {extractedData.lineItems.map((item, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="flex justify-between">
                          <span className="text-muted-foreground">{item.name} {item.quantity > 1 ? `x${item.quantity}` : ""}</span>
                          <span className="font-mono">${item.price.toFixed(2)}</span>
                        </motion.div>
                      ))}
                    </div>
                    <div className="flex justify-between text-lg font-mono font-bold text-[#c2b59b] border-t border-border pt-2">
                      <span>Total</span><span>${extractedData.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="surface">
              <CardContent className="py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-mono text-muted-foreground uppercase">Description</label><Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" /></div>
                  <div><label className="text-[10px] font-mono text-muted-foreground uppercase">Amount</label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" /></div>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase">Who paid?</label>
                  <div className="flex gap-2 mt-1">
                    {trip.participants.map((p, idx) => (
                      <button key={p.id} onClick={() => setPaidBy(p.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-all border"
                        style={{
                          borderColor: paidBy === p.id ? ACCENT_COLORS[idx % ACCENT_COLORS.length] : "#2e2b29",
                          backgroundColor: paidBy === p.id ? `${ACCENT_COLORS[idx % ACCENT_COLORS.length]}10` : "transparent",
                        }}>
                        <span className="font-mono font-bold text-xs">{p.name.charAt(0)}</span> {p.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveExpense} disabled={!description || !amount} className="bg-[#b45534] hover:bg-[#9a4529] text-white border-0 flex-1">
                    <Receipt className="mr-2 h-4 w-4" /> Add / ${amount ? (parseFloat(amount) / trip.participants.length).toFixed(2) : "0"} per person
                  </Button>
                  <Button variant="ghost" onClick={() => { setPhase("dashboard"); setPreview(null); setExtractedData(null); }}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duplicate */}
      {duplicate && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="border-[#c4893b]/30">
            <CardContent className="py-4 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-[#c4893b] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-[#c4893b] text-sm">Duplicate Receipt Blocked</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(duplicate.similarity * 100).toFixed(0)}% match. Same CID on IPFS. Prevented double-counting.
                </p>
                {duplicate.matchCid && <p className="text-[9px] font-mono text-muted-foreground mt-1">CID: {duplicate.matchCid}</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDuplicate(null)}><X className="h-3 w-3" /></Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {uploadError && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-[#b45534] text-sm">
          <AlertTriangle className="h-4 w-4" />{uploadError}
          <Button variant="ghost" size="sm" onClick={() => setUploadError(null)}><X className="h-3 w-3" /></Button>
        </motion.div>
      )}

      {/* Expenses */}
      {phase === "dashboard" && trip.expenses.length > 0 && (
        <motion.div layout className="space-y-2">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Expenses</p>
          {trip.expenses.map((expense, i) => (
            <motion.div key={expense.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="border border-border p-3 hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 bg-secondary flex items-center justify-center font-mono font-bold text-sm"
                    style={{ borderLeft: `2px solid ${ACCENT_COLORS[getIdx(expense.paidBy) % ACCENT_COLORS.length]}` }}
                  >
                    {getName(expense.paidBy).charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{expense.description}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                      <span>Paid by {getName(expense.paidBy)}</span>
                      {expense.receipt?.pinataCid && (
                        <>
                          <span>/</span>
                          <span className="text-[#c4893b]/70 flex items-center gap-1">
                            <Fingerprint className="h-2.5 w-2.5" /> {expense.receipt.pinataCid.slice(0, 12)}...
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-sm text-[#c2b59b]">${expense.amount.toFixed(2)}</p>
                    <p className="text-[9px] font-mono text-muted-foreground">${(expense.amount / trip.participants.length).toFixed(2)} ea</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Settle button */}
      {phase === "dashboard" && obligations.length > 0 && trip.status !== "settled" && (
        <motion.div layout className="space-y-3">
          <p className="text-xs text-muted-foreground text-center font-mono">
            {obligations.length} optimized transfer{obligations.length !== 1 ? "s" : ""}
          </p>
          {!trip.participants.every((p) => trip.approvals?.[p.id]?.approved) ? (
            <Link href={`/trip/${tripId}/approve`}>
              <Button className="w-full bg-[#6b7c5e] hover:bg-[#5a6b4f] text-white border-0 font-bold text-base py-6" size="lg">
                <Shield className="mr-2 h-5 w-5" />
                Get Participant Approval ({trip.participants.filter((p) => trip.approvals?.[p.id]?.approved).length}/{trip.participants.length})
              </Button>
            </Link>
          ) : (
            <Button onClick={startSettlement} className="w-full bg-[#b45534] hover:bg-[#9a4529] text-white border-0 font-bold text-base py-6" size="lg">
              <Zap className="mr-2 h-5 w-5" />
              Settle on XRPL
            </Button>
          )}
          <p className="text-[9px] text-muted-foreground text-center font-mono">
            XRP Ledger Testnet / Receipt CIDs in transaction memo
          </p>
        </motion.div>
      )}

      {/* Settlement proof */}
      {phase === "settle-complete" && settleResults.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="space-y-5">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <div className="border border-[#6b7c5e]/30 p-5">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-[#6b7c5e]" />
                <p className="font-bold text-[#6b7c5e]">All Settled On-Chain</p>
              </div>
              <p className="text-xs text-muted-foreground">Every receipt on IPFS. Every payment on the XRP Ledger.</p>
            </div>
          </motion.div>

          <div className="space-y-2">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Shield className="h-3 w-3" /> Transaction Proof
            </p>

            {settleResults.map((o, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.2 }}>
                <div className={`border p-4 space-y-3 ${o.status === "confirmed" ? "border-[#6b7c5e]/20" : "border-[#b45534]/20"}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-secondary flex items-center justify-center font-mono font-bold text-sm"
                      style={{ borderLeft: `2px solid ${ACCENT_COLORS[getIdx(o.from) % ACCENT_COLORS.length]}` }}>
                      {getName(o.from).charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold">{o.fromName || getName(o.from)}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-semibold">{o.toName || getName(o.to)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-[#c2b59b]">${o.rlusdAmount.toFixed(2)}</p>
                      <p className="text-[9px] font-mono text-muted-foreground">XRP</p>
                    </div>
                    {o.status === "confirmed" ? <CheckCircle className="h-4 w-4 text-[#6b7c5e]" /> : <XCircle className="h-4 w-4 text-[#b45534]" />}
                  </div>

                  {o.txHash && (
                    <div className="space-y-2">
                      <a href={o.explorerUrl || `https://testnet.xrpl.org/transactions/${o.txHash}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 border border-[#6b7c5e]/20 px-3 py-2 hover:bg-secondary/50 transition-colors">
                        <Zap className="h-3.5 w-3.5 text-[#6b7c5e] flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-mono text-[#6b7c5e] uppercase tracking-widest">XRPL TX</p>
                          <p className="text-[10px] font-mono text-muted-foreground truncate">{o.txHash}</p>
                        </div>
                        <ExternalLink className="h-3 w-3 text-[#6b7c5e] flex-shrink-0" />
                      </a>

                      {o.memo && (
                        <div className="flex items-center gap-2 border border-[#c4893b]/10 px-3 py-2">
                          <Fingerprint className="h-3.5 w-3.5 text-[#c4893b] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] font-mono text-[#c4893b] uppercase tracking-widest">Memo: CID + SHA-256</p>
                            <p className="text-[9px] font-mono text-muted-foreground truncate">{o.memo}</p>
                          </div>
                        </div>
                      )}

                      <Link href={`/verify?tx=${o.txHash}`}
                        className="flex items-center gap-2 border border-border px-3 py-2 hover:bg-secondary/50 transition-colors">
                        <Shield className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Verify Proof Chain</p>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      </Link>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {trip.expenses.some((e) => e.receipt?.pinataCid) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="space-y-2">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <FileCheck className="h-3 w-3" /> IPFS Artifacts
              </p>
              {trip.expenses.filter((e) => e.receipt?.pinataCid).map((e, i) => (
                <div key={i} className="border border-[#c4893b]/10 p-3 flex items-center gap-3">
                  <Receipt className="h-4 w-4 text-[#c4893b]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{e.description}</p>
                    <p className="text-[9px] font-mono text-muted-foreground truncate">{e.receipt!.pinataCid}</p>
                  </div>
                  {e.receipt?.gatewayUrl ? (
                    <a href={e.receipt.gatewayUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] font-mono text-[#c4893b] border border-[#c4893b]/20 px-2 py-0.5 hover:bg-[#c4893b]/5 transition-colors flex items-center gap-1">
                      VIEW <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ) : (
                    <span className="text-[9px] font-mono text-[#c4893b] border border-[#c4893b]/20 px-2 py-0.5">IPFS</span>
                  )}
                </div>
              ))}
            </motion.div>
          )}

          {/* Summary */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}
            className="border border-[#6b7c5e]/10 p-5">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">Audit Summary</p>
            <div className="flex gap-8 text-sm">
              <div>
                <p className="text-xl font-mono font-bold text-[#6b7c5e]">{settleResults.filter((r) => r.status === "confirmed").length}</p>
                <p className="text-[9px] font-mono text-muted-foreground uppercase">On-chain TXs</p>
              </div>
              <div className="w-px bg-border" />
              <div>
                <p className="text-xl font-mono font-bold text-[#c4893b]">{trip.expenses.filter((e) => e.receipt?.pinataCid).length}</p>
                <p className="text-[9px] font-mono text-muted-foreground uppercase">IPFS Receipts</p>
              </div>
              <div className="w-px bg-border" />
              <div>
                <p className="text-xl font-mono font-bold text-[#c2b59b]">{trip.participants.length}</p>
                <p className="text-[9px] font-mono text-muted-foreground uppercase">Wallets</p>
              </div>
            </div>
          </motion.div>

          <div className="flex gap-3">
            <Link href={`/verify?tripId=${tripId}`} className="flex-1">
              <Button className="w-full bg-[#1c1a19] hover:bg-[#252321] text-[#c4893b] border border-[#c4893b]/30 font-semibold">
                <Shield className="mr-2 h-4 w-4" /> Verify All On-Chain
              </Button>
            </Link>
            <Link href={`/live/${tripId}`} target="_blank" className="flex-1">
              <Button variant="outline" className="w-full border-border text-muted-foreground hover:bg-secondary">
                <ExternalLink className="mr-2 h-4 w-4" /> Live View
              </Button>
            </Link>
          </div>

          <Button variant="ghost" onClick={() => setPhase("dashboard")} className="w-full text-muted-foreground">Back to Dashboard</Button>
        </motion.div>
      )}
    </div>
  );
}
