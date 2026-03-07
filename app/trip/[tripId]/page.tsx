"use client";

import { useState, useEffect, use, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Trip, ReceiptArtifact, ExtractedReceipt } from "@/lib/types";
import { calculateBalances, minimizeDebts } from "@/lib/splits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NetworkStatus } from "@/app/components/NetworkStatus";
import {
  ArrowLeft, Upload, Zap, Receipt, CheckCircle, Loader2, XCircle,
  ExternalLink, AlertTriangle, ArrowRight, Wallet, Shield, FileCheck,
  Globe, Fingerprint,
} from "lucide-react";
import Link from "next/link";

type Phase = "dashboard" | "uploading" | "extracting" | "extracted" | "settling-wallets" | "settling-payments" | "settle-complete";

type EnrichedObligation = {
  from: string; to: string; amount: number; rlusdAmount: number;
  txHash?: string; status: string; fromName?: string; toName?: string; explorerUrl?: string;
  memo?: string; fromAddress?: string; toAddress?: string; currency?: string;
};

type WalletBalance = { address: string; xrp: string; rlusd: string; hasTrustline: boolean };

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

  // Upload
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedReceipt | null>(null);
  const [uploadedArtifact, setUploadedArtifact] = useState<ReceiptArtifact | null>(null);
  const [duplicate, setDuplicate] = useState<{ similarity: number; matchCid?: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Expense form
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");

  // Settlement
  const [settleResults, setSettleResults] = useState<EnrichedObligation[]>([]);
  const [activePaymentIndex, setActivePaymentIndex] = useState(-1);
  const [flyingCoins, setFlyingCoins] = useState<{ from: number; to: number; amount: number; id: number }[]>([]);
  const coinIdRef = useRef(0);

  // Web3: wallet balances
  const [walletBalances, setWalletBalances] = useState<Map<string, WalletBalance>>(new Map());
  const [settlementMeta, setSettlementMeta] = useState<{ receiptCids?: string; currency?: string } | null>(null);

  const loadTrip = useCallback(() => {
    fetch(`/api/trips/${tripId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setTrip(data);
        if (data?.participants[0] && !paidBy) setPaidBy(data.participants[0].id);
        setLoading(false);
        // Fetch wallet balances for any funded participants
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
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
          <Loader2 className="h-8 w-8 text-[#10b981]" />
        </motion.div>
      </div>
    );
  }

  const getName = (id: string) => trip.participants.find((p) => p.id === id)?.name || "?";
  const getAvatar = (id: string) => trip.participants.find((p) => p.id === id)?.avatar || "🧑";
  const getIdx = (id: string) => trip.participants.findIndex((p) => p.id === id);
  const balances = trip.expenses.length > 0 ? calculateBalances(trip.expenses, trip.participants) : [];
  const obligations = trip.expenses.length > 0 ? minimizeDebts(trip.expenses, trip.participants) : [];
  const totalExpenses = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const positions = getParticipantPositions(trip.participants.length);
  const walletsReady = trip.participants.every((p) => p.wallet?.address);

  // --- Upload ---
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
      setUploadedArtifact({ pinataCid: data.pinataCid, pinataFileId: data.pinataFileId, fileName: data.fileName, mimeType: data.mimeType, extractedData: data.extractedData });
      if (data.extractedData) {
        if (data.extractedData.vendor !== "Unknown") setDescription(data.extractedData.vendor);
        if (data.extractedData.total > 0) setAmount(data.extractedData.total.toString());
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

  // --- Settlement ---
  const startSettlement = async () => {
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
        for (let c = 0; c < 5; c++) {
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
      {/* --- TOP BAR --- */}
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground text-sm">
          <ArrowLeft className="h-4 w-4 mr-1" /> All Trips
        </Link>
        <NetworkStatus />
      </div>

      {/* --- HEADER --- */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{trip.name}</h1>
          <p className="text-muted-foreground mt-1">
            ${totalExpenses.toFixed(2)} total &middot; {trip.expenses.length} expense{trip.expenses.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Badge className={trip.status === "settled" ? "bg-[#10b981] text-white" : "text-[#f59e0b] border-[#f59e0b]/30"} variant={trip.status === "settled" ? "default" : "outline"}>
          {trip.status === "settled" ? "✓ Settled" : "Active"}
        </Badge>
      </div>

      {/* ======== PARTICIPANT NETWORK ======== */}
      <div className="relative mx-auto" style={{ width: 400, height: 240 }}>
        {/* Connection lines */}
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
                  stroke={isActive ? "#f59e0b" : isDone ? "#10b981" : "rgba(255,255,255,0.06)"}
                  strokeWidth={isActive ? 3 : 1.5} strokeDasharray={isActive ? "none" : "6 4"} />
                <text x={(fromPos.x + toPos.x) / 2} y={(fromPos.y + toPos.y) / 2 - 8}
                  fill={isActive ? "#f59e0b" : isDone ? "#10b981" : "#94a3b8"}
                  fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                  ${o.amount.toFixed(2)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Flying coins */}
        <AnimatePresence>
          {flyingCoins.map((coin) => {
            const fromPos = positions[coin.from]; const toPos = positions[coin.to];
            if (!fromPos || !toPos) return null;
            return (
              <motion.div key={coin.id} className="absolute text-2xl pointer-events-none z-20"
                initial={{ x: fromPos.x - 14, y: fromPos.y - 14, scale: 0, opacity: 0 }}
                animate={{ x: toPos.x - 14, y: toPos.y - 14, scale: [0, 1.3, 1, 0.8], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 0.9, ease: "easeInOut" }}
                onAnimationComplete={() => setFlyingCoins((prev) => prev.filter((c) => c.id !== coin.id))}>
                🪙
              </motion.div>
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

          return (
            <motion.div key={p.id} className="absolute flex flex-col items-center"
              style={{ left: pos.x - 40, top: pos.y - 40 }}
              animate={{ scale: isActiveSender || isActiveReceiver ? 1.12 : 1 }}
              transition={{ type: "spring", stiffness: 300 }}>
              <div className="relative">
                <motion.div
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl border-3 transition-colors ${
                    isSettled ? "border-[#10b981] bg-[#10b981]/10" :
                    isActiveSender ? "border-[#ef4444] bg-[#ef4444]/10" :
                    isActiveReceiver ? "border-[#10b981] bg-[#10b981]/10" :
                    "border-border bg-secondary"
                  }`}
                  animate={
                    isActiveSender ? { boxShadow: ["0 0 0px #ef4444", "0 0 20px #ef4444", "0 0 0px #ef4444"] } :
                    isActiveReceiver ? { boxShadow: ["0 0 0px #10b981", "0 0 20px #10b981", "0 0 0px #10b981"] } :
                    isSettled ? { boxShadow: "0 0 15px rgba(16,185,129,0.3)" } : {}
                  }
                  transition={{ repeat: isActiveSender || isActiveReceiver ? Infinity : 0, duration: 0.8 }}>
                  {p.avatar}
                </motion.div>

                {/* Balance badge */}
                {bal && Math.abs(bal.amount) > 0.01 && !isSettled && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className={`absolute -bottom-1 -right-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${bal.amount > 0 ? "bg-[#10b981] text-white" : "bg-[#ef4444] text-white"}`}>
                    {bal.amount > 0 ? "+" : ""}${Math.abs(bal.amount).toFixed(0)}
                  </motion.div>
                )}

                {/* Settled check */}
                {isSettled && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ delay: 0.3 + i * 0.1 }} className="absolute -bottom-1 -right-1">
                    <CheckCircle className="h-5 w-5 text-[#10b981] fill-[#10b981]/20" />
                  </motion.div>
                )}
              </div>

              <span className="text-xs font-medium mt-1">{p.name}</span>

              {/* Wallet info */}
              {p.wallet?.address && (
                <div className="flex flex-col items-center mt-0.5">
                  <span className="text-[8px] font-mono text-muted-foreground/50">{p.wallet.address.slice(0, 8)}...</span>
                  {wb && (
                    <div className="flex gap-1.5 mt-0.5">
                      <span className="text-[8px] font-mono text-[#3b82f6]/70">{Number(wb.xrp).toFixed(0)} XRP</span>
                      {Number(wb.rlusd) > 0 && <span className="text-[8px] font-mono text-[#10b981]/70">{Number(wb.rlusd).toFixed(0)} RLUSD</span>}
                    </div>
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
              <motion.div key="wallets" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                <Loader2 className="h-6 w-6 text-[#10b981] animate-spin" />
                <span className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap">Funding wallets...</span>
              </motion.div>
            )}
            {phase === "settling-payments" && activePaymentIndex >= 0 && (
              <motion.div key="paying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} className="text-2xl">⚡</motion.div>
                <span className="text-[10px] text-[#f59e0b] font-bold mt-1">Payment {activePaymentIndex + 1}/{obligations.length}</span>
              </motion.div>
            )}
            {phase === "settle-complete" && (
              <motion.div key="done" initial={{ scale: 0 }} animate={{ scale: [0, 1.4, 1] }} className="text-3xl">✅</motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ======== UPLOAD ZONE ======== */}
      <AnimatePresence mode="wait">
        {phase === "dashboard" && trip.status !== "settled" && (
          <motion.div key="dropzone" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <motion.div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              animate={{ borderColor: dragOver ? "#10b981" : "rgba(255,255,255,0.08)", backgroundColor: dragOver ? "rgba(16,185,129,0.05)" : "rgba(17,22,56,0.4)" }}
              className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer hover:border-[#10b981]/30 transition-all"
              onClick={() => document.getElementById("receipt-input")?.click()}>
              <input id="receipt-input" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl gradient-emerald flex items-center justify-center">
                  <Upload className="h-6 w-6 text-white" />
                </div>
                <p className="font-semibold text-lg">Drop a receipt</p>
                <p className="text-sm text-muted-foreground">Uploads to IPFS &middot; AI reads it &middot; Splits automatically</p>
              </div>
            </motion.div>
          </motion.div>
        )}

        {phase === "uploading" && (
          <motion.div key="uploading" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <Card className="glass-card">
              <CardContent className="py-8 flex flex-col items-center gap-4">
                <div className="relative">
                  {preview && <img src={preview} alt="" className="w-20 h-28 object-cover rounded-xl opacity-50" />}
                  <motion.div className="absolute inset-0 flex items-center justify-center" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
                    <Loader2 className="h-8 w-8 text-[#f59e0b]" />
                  </motion.div>
                </div>
                <p className="font-semibold">Pinning to IPFS via Pinata...</p>
                <p className="text-xs text-muted-foreground font-mono">Generating content-addressed CID</p>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => <motion.div key={i} className="w-2 h-2 rounded-full bg-[#f59e0b]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }} />)}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {phase === "extracting" && (
          <motion.div key="extracting" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <Card className="glass-card">
              <CardContent className="py-8 flex flex-col items-center gap-4">
                <motion.div animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-5xl">🧠</motion.div>
                <p className="font-semibold">AI reading your receipt...</p>
                <p className="text-sm text-muted-foreground">GPT-4o Vision extracting line items &amp; totals</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {phase === "extracted" && extractedData && (
          <motion.div key="extracted" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* CID Proof Banner */}
            {uploadedArtifact?.pinataCid && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl px-4 py-2 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center">
                  <Fingerprint className="h-4 w-4 text-[#f59e0b]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#f59e0b] font-semibold uppercase tracking-wider">IPFS Content Identifier</p>
                  <p className="text-xs font-mono text-foreground truncate">{uploadedArtifact.pinataCid}</p>
                </div>
                <Badge variant="outline" className="text-[#f59e0b] border-[#f59e0b]/30 text-[10px]">
                  <Globe className="h-3 w-3 mr-1" /> Pinned
                </Badge>
              </motion.div>
            )}

            <Card className="glass-card border-[#10b981]/20 overflow-hidden">
              <CardContent className="py-0">
                <div className="flex gap-5">
                  {preview && (
                    <div className="w-32 flex-shrink-0 -ml-6">
                      <img src={preview} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 py-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-[#10b981]" />
                      <span className="text-sm font-semibold text-[#10b981]">Extracted &amp; Verified</span>
                    </div>
                    <p className="text-2xl font-bold">{extractedData.vendor}</p>
                    <div className="space-y-0.5 text-sm">
                      {extractedData.lineItems.map((item, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex justify-between">
                          <span className="text-muted-foreground">{item.name} {item.quantity > 1 ? `×${item.quantity}` : ""}</span>
                          <span>${item.price.toFixed(2)}</span>
                        </motion.div>
                      ))}
                    </div>
                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="flex justify-between text-xl font-bold text-[#10b981] border-t border-border pt-2">
                      <span>Total</span><span>${extractedData.total.toFixed(2)}</span>
                    </motion.div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-muted-foreground">Description</label><Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" /></div>
                  <div><label className="text-xs text-muted-foreground">Amount</label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" /></div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Who paid?</label>
                  <div className="flex gap-2 mt-1">
                    {trip.participants.map((p) => (
                      <button key={p.id} onClick={() => setPaidBy(p.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${paidBy === p.id ? "bg-[#10b981] text-white" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}>
                        {p.avatar} {p.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveExpense} disabled={!description || !amount} className="gradient-emerald text-white border-0 flex-1">
                    <Receipt className="mr-2 h-4 w-4" /> Add &amp; Split ${amount ? (parseFloat(amount) / trip.participants.length).toFixed(2) : "0"}/person
                  </Button>
                  <Button variant="ghost" onClick={() => { setPhase("dashboard"); setPreview(null); setExtractedData(null); }}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duplicate warning */}
      {duplicate && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-[#f59e0b]/30 bg-[#f59e0b]/5">
            <CardContent className="py-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-[#f59e0b] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-[#f59e0b]">Duplicate Receipt Blocked!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {(duplicate.similarity * 100).toFixed(0)}% match — same CID already exists on IPFS. Prevented double-counting.
                </p>
                {duplicate.matchCid && <p className="text-[10px] font-mono text-muted-foreground mt-1">CID: {duplicate.matchCid}</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDuplicate(null)}>✕</Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {uploadError && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle className="h-4 w-4" />{uploadError}
          <Button variant="ghost" size="sm" onClick={() => setUploadError(null)}>✕</Button>
        </motion.div>
      )}

      {/* ======== EXPENSES ======== */}
      {phase === "dashboard" && trip.expenses.length > 0 && (
        <motion.div layout className="space-y-3">
          <h2 className="text-lg font-semibold">Expenses</h2>
          {trip.expenses.map((expense, i) => (
            <motion.div key={expense.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="glass-card hover:border-[#10b981]/10 transition-colors">
                <CardContent className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center text-lg">
                      {getAvatar(expense.paidBy)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{expense.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Paid by {getName(expense.paidBy)}</span>
                        {expense.receipt?.pinataCid && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-[#f59e0b]/70 flex items-center gap-1">
                              <Fingerprint className="h-3 w-3" /> {expense.receipt.pinataCid.slice(0, 12)}...
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#10b981]">${expense.amount.toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">${(expense.amount / trip.participants.length).toFixed(2)} ea</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ======== SETTLE BUTTON ======== */}
      {phase === "dashboard" && obligations.length > 0 && trip.status !== "settled" && (
        <motion.div layout className="space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            {obligations.length} optimized transfer{obligations.length !== 1 ? "s" : ""} needed
          </p>
          <Button onClick={startSettlement} className="w-full gradient-gold text-[#0a0e27] border-0 font-bold text-lg py-7" size="lg">
            <Zap className="mr-2 h-6 w-6" />
            Settle on XRPL — {obligations.length} XRP Payment{obligations.length !== 1 ? "s" : ""}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center font-mono">
            XRP Ledger Testnet &middot; Receipt CIDs embedded in transaction memo field
          </p>
        </motion.div>
      )}

      {/* ======== SETTLEMENT PROOF WALL ======== */}
      {phase === "settle-complete" && settleResults.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="space-y-5">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="text-center">
            <h2 className="text-2xl font-bold text-[#10b981]">All Settled On-Chain!</h2>
            <p className="text-muted-foreground">Every receipt on IPFS. Every payment on the XRP Ledger.</p>
          </motion.div>

          {/* Proof chain */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" /> Transaction Proof
            </h3>

            {settleResults.map((o, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.2 }}>
                <Card className={`glass-card ${o.status === "confirmed" ? "border-[#10b981]/20" : "border-red-500/20"}`}>
                  <CardContent className="py-4 space-y-3">
                    {/* Payment header */}
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getAvatar(o.from)}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{o.fromName || getName(o.from)}</span>
                          <ArrowRight className="h-4 w-4 text-[#f59e0b]" />
                          <span className="font-semibold">{o.toName || getName(o.to)}</span>
                        </div>
                      </div>
                      <span className="text-2xl">{getAvatar(o.to)}</span>
                      <div className="text-right ml-2">
                        <p className="text-xl font-bold text-[#10b981]">${o.rlusdAmount.toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">XRP</p>
                      </div>
                      {o.status === "confirmed" ? <CheckCircle className="h-6 w-6 text-[#10b981]" /> : <XCircle className="h-6 w-6 text-red-400" />}
                    </div>

                    {/* On-chain proof links */}
                    {o.txHash && (
                      <div className="space-y-2">
                        <a href={o.explorerUrl || `https://testnet.xrpl.org/transactions/${o.txHash}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-[#10b981]/5 border border-[#10b981]/20 rounded-lg px-3 py-2.5 hover:bg-[#10b981]/10 transition-colors">
                          <Zap className="h-4 w-4 text-[#10b981] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-[#10b981] font-bold uppercase tracking-wider">XRPL Transaction</p>
                            <p className="text-[11px] font-mono text-muted-foreground truncate">{o.txHash}</p>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 text-[#10b981] flex-shrink-0" />
                        </a>

                        {/* Memo field showing CID + Hash */}
                        {o.memo && (
                          <div className="flex items-center gap-2 bg-[#f59e0b]/5 border border-[#f59e0b]/10 rounded-lg px-3 py-2">
                            <Fingerprint className="h-4 w-4 text-[#f59e0b] flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-[#f59e0b] font-bold uppercase tracking-wider">On-Chain Memo — CID + SHA-256 Hash</p>
                              <p className="text-[10px] font-mono text-muted-foreground truncate">{o.memo}</p>
                            </div>
                          </div>
                        )}

                        {/* Verify link */}
                        {o.txHash && (
                          <Link href={`/verify?tx=${o.txHash}`}
                            className="flex items-center gap-2 bg-[#3b82f6]/5 border border-[#3b82f6]/10 rounded-lg px-3 py-2 hover:bg-[#3b82f6]/10 transition-colors">
                            <Shield className="h-4 w-4 text-[#3b82f6] flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-[10px] text-[#3b82f6] font-bold uppercase tracking-wider">Verify Proof Chain</p>
                              <p className="text-[10px] text-muted-foreground">Decode memo, verify CID + hash on-chain</p>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-[#3b82f6] flex-shrink-0" />
                          </Link>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* IPFS Artifacts */}
          {trip.expenses.some((e) => e.receipt?.pinataCid) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="h-3.5 w-3.5" /> IPFS Receipt Artifacts
              </h3>
              {trip.expenses.filter((e) => e.receipt?.pinataCid).map((e, i) => (
                <Card key={i} className="glass-card border-[#f59e0b]/10">
                  <CardContent className="py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center">
                      <Receipt className="h-4 w-4 text-[#f59e0b]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{e.description}</p>
                      <p className="text-[10px] font-mono text-muted-foreground truncate">{e.receipt!.pinataCid}</p>
                    </div>
                    <Badge variant="outline" className="text-[#f59e0b] border-[#f59e0b]/30 text-[10px]">
                      <Globe className="h-3 w-3 mr-1" /> IPFS
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          )}

          {/* Summary banner */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2 }}
            className="glass rounded-2xl p-5 text-center space-y-2 border border-[#10b981]/10">
            <p className="text-sm text-muted-foreground">Verifiable audit trail</p>
            <div className="flex justify-center gap-6 text-sm">
              <div>
                <p className="text-2xl font-bold text-[#10b981]">{settleResults.filter((r) => r.status === "confirmed").length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">On-chain TXs</p>
              </div>
              <div className="w-px bg-border" />
              <div>
                <p className="text-2xl font-bold text-[#f59e0b]">{trip.expenses.filter((e) => e.receipt?.pinataCid).length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">IPFS Receipts</p>
              </div>
              <div className="w-px bg-border" />
              <div>
                <p className="text-2xl font-bold text-[#3b82f6]">{trip.participants.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Wallets</p>
              </div>
            </div>
          </motion.div>

          <Button variant="ghost" onClick={() => setPhase("dashboard")} className="w-full">Back to Dashboard</Button>
        </motion.div>
      )}
    </div>
  );
}
