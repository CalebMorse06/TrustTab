"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NetworkStatus } from "@/app/components/NetworkStatus";
import {
  ArrowLeft, Search, CheckCircle, XCircle, Shield, Fingerprint,
  Globe, Zap, ArrowRight, Loader2, ExternalLink, Lock,
} from "lucide-react";
import Link from "next/link";

type VerifyResult = {
  txHash: string;
  found: boolean;
  success?: boolean;
  account?: string;
  destination?: string;
  amount?: { value: string; currency: string };
  fee?: string;
  ledgerIndex?: number;
  date?: string;
  memo?: {
    raw: string;
    decoded: string;
    receiptProofs: { cid: string; hash: string; verified: boolean }[];
  };
  explorerUrl?: string;
  error?: string;
};

type TripSettlement = {
  tripName: string;
  tripId: string;
  obligations: {
    txHash: string;
    fromName: string;
    toName: string;
    rlusdAmount: number;
    status: string;
    explorerUrl?: string;
    memo?: string;
  }[];
};

export default function VerifyPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 text-muted-foreground animate-spin" /></div>}>
      <VerifyPage />
    </Suspense>
  );
}

function VerifyPage() {
  const searchParams = useSearchParams();
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [autoVerified, setAutoVerified] = useState(false);

  const [tripData, setTripData] = useState<TripSettlement | null>(null);
  const [tripLoading, setTripLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<Map<string, VerifyResult>>(new Map());
  const [batchVerifying, setBatchVerifying] = useState(false);

  useEffect(() => {
    const tx = searchParams.get("tx");
    if (tx && !autoVerified) {
      setTxHash(tx);
      setAutoVerified(true);
      verifyTx(tx);
    }

    const tripId = searchParams.get("tripId");
    if (tripId && !tripData) {
      loadTripTransactions(tripId);
    }
  }, [searchParams, autoVerified, tripData]);

  const loadTripTransactions = async (tripId: string) => {
    setTripLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) return;
      const trip = await res.json();
      if (trip.settlementStatus?.obligations) {
        setTripData({
          tripName: trip.name,
          tripId: trip.id,
          obligations: trip.settlementStatus.obligations.map((o: any) => ({
            txHash: o.txHash || "",
            fromName: o.fromName || "",
            toName: o.toName || "",
            rlusdAmount: o.rlusdAmount,
            status: o.status,
            explorerUrl: o.explorerUrl,
            memo: o.memo,
          })),
        });
      }
    } catch {
      // Trip not found
    } finally {
      setTripLoading(false);
    }
  };

  const verifyAllTransactions = async () => {
    if (!tripData) return;
    setBatchVerifying(true);
    const hashes = tripData.obligations.filter((o) => o.txHash).map((o) => o.txHash);
    const newResults = new Map<string, VerifyResult>();

    for (const hash of hashes) {
      try {
        const res = await fetch(`/api/verify?tx=${hash}`);
        const data = await res.json();
        newResults.set(hash, data);
      } catch {
        newResults.set(hash, { txHash: hash, found: false, error: "Verification failed" });
      }
    }

    setBatchResults(newResults);
    setBatchVerifying(false);
  };

  const verifyTx = async (hash: string) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/verify?tx=${hash.trim()}`);
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ txHash: hash, found: false, error: "Verification failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground text-xs font-mono">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
        </Link>
        <NetworkStatus />
      </div>

      <div className="py-12">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mb-4">Transaction Verification</p>
          <h1 className="text-3xl font-bold mb-3">Verify On-Chain</h1>
          <p className="text-muted-foreground text-sm max-w-md">
            Paste any XRPL transaction hash to verify the payment and its linked receipt artifacts.
          </p>
        </motion.div>
      </div>

      <div className="flex gap-2 max-w-2xl">
        <Input
          placeholder="XRPL transaction hash..."
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && verifyTx(txHash)}
          className="font-mono text-sm"
        />
        <Button onClick={() => verifyTx(txHash)} disabled={loading || !txHash.trim()} className="bg-[#b45534] hover:bg-[#9a4529] text-white border-0 px-6">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {/* Trip-level batch verification */}
      {tripLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading trip transactions...
        </div>
      )}

      {tripData && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl space-y-4">
          <div className="border border-[#c4893b]/20 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono text-[#c4893b] uppercase tracking-[0.2em]">Trip Settlement</p>
                <p className="font-bold text-lg mt-1">{tripData.tripName}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {tripData.obligations.length} transaction{tripData.obligations.length !== 1 ? "s" : ""} on XRPL testnet
                </p>
              </div>
              <Link href={`/trip/${tripData.tripId}`} className="text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border px-3 py-1.5">
                View Trip
              </Link>
            </div>

            <div className="space-y-2">
              {tripData.obligations.map((o, i) => {
                const verified = batchResults.get(o.txHash);
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className="border border-border p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs font-semibold">{o.fromName}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-semibold">{o.toName}</span>
                      </div>
                      <span className="font-mono font-bold text-xs text-[#c2b59b]">${o.rlusdAmount.toFixed(2)}</span>
                      {verified ? (
                        verified.found && verified.success ? (
                          <CheckCircle className="h-4 w-4 text-[#6b7c5e]" />
                        ) : (
                          <XCircle className="h-4 w-4 text-[#b45534]" />
                        )
                      ) : (
                        <span className={`text-[9px] font-mono uppercase ${o.status === "confirmed" ? "text-[#6b7c5e]" : "text-[#b45534]"}`}>
                          {o.status}
                        </span>
                      )}
                    </div>
                    {o.txHash && (
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-muted-foreground truncate flex-1">{o.txHash}</span>
                        <button
                          onClick={() => { setTxHash(o.txHash); verifyTx(o.txHash); }}
                          className="text-[9px] font-mono text-[#b45534] hover:opacity-80 flex-shrink-0"
                        >
                          INSPECT
                        </button>
                        {o.explorerUrl && (
                          <a href={o.explorerUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                            <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                          </a>
                        )}
                      </div>
                    )}
                    {verified && verified.found && verified.memo && verified.memo.receiptProofs.length > 0 && (
                      <div className="border-t border-border pt-2 mt-2 space-y-1">
                        {verified.memo.receiptProofs.map((proof, pi) => (
                          <div key={pi} className="flex items-center gap-2 text-[9px] font-mono">
                            <Globe className="h-3 w-3 text-[#c4893b] flex-shrink-0" />
                            <span className="text-muted-foreground truncate">{proof.cid}</span>
                            <CheckCircle className="h-3 w-3 text-[#6b7c5e] flex-shrink-0" />
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            <Button
              onClick={verifyAllTransactions}
              disabled={batchVerifying}
              className="w-full bg-[#b45534] hover:bg-[#9a4529] text-white border-0 font-semibold"
            >
              {batchVerifying ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying on XRPL...</>
              ) : batchResults.size > 0 ? (
                <><CheckCircle className="mr-2 h-4 w-4" />All Verified &mdash; Re-verify</>
              ) : (
                <><Shield className="mr-2 h-4 w-4" />Verify All On-Chain</>
              )}
            </Button>

            {batchResults.size > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-[#6b7c5e]/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-[#6b7c5e]" />
                  <p className="text-sm font-bold text-[#6b7c5e]">Verification Complete</p>
                </div>
                <div className="flex gap-6 text-xs font-mono">
                  <div>
                    <span className="text-[#6b7c5e] font-bold">{Array.from(batchResults.values()).filter((r) => r.found && r.success).length}</span>
                    <span className="text-muted-foreground ml-1">confirmed</span>
                  </div>
                  <div>
                    <span className="text-[#b45534] font-bold">{Array.from(batchResults.values()).filter((r) => !r.found || !r.success).length}</span>
                    <span className="text-muted-foreground ml-1">failed</span>
                  </div>
                  <div>
                    <span className="text-[#c4893b] font-bold">
                      {Array.from(batchResults.values()).filter((r) => r.memo && r.memo.receiptProofs.length > 0).length}
                    </span>
                    <span className="text-muted-foreground ml-1">with receipt proofs</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {/* Single transaction result */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl space-y-4">
            {!result.found ? (
              <div className="border border-[#b45534]/20 p-5 flex items-center gap-3">
                <XCircle className="h-5 w-5 text-[#b45534]" />
                <p className="text-[#b45534] text-sm font-medium">Transaction not found on the XRP Ledger</p>
              </div>
            ) : (
              <>
                <Card className={`surface ${result.success ? "border-[#6b7c5e]/20" : "border-[#b45534]/20"}`}>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      {result.success ? (
                        <CheckCircle className="h-5 w-5 text-[#6b7c5e]" />
                      ) : (
                        <XCircle className="h-5 w-5 text-[#b45534]" />
                      )}
                      <div>
                        <p className="font-bold text-sm">{result.success ? "Transaction Verified" : "Transaction Failed"}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">XRP Ledger Testnet</p>
                      </div>
                      <span className="ml-auto text-[9px] font-mono text-[#6b7c5e] border border-[#6b7c5e]/20 px-2 py-0.5">ON-CHAIN</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="border border-border p-3">
                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1">From</p>
                        <p className="font-mono text-[11px] truncate">{result.account}</p>
                      </div>
                      <div className="border border-border p-3">
                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1">To</p>
                        <p className="font-mono text-[11px] truncate">{result.destination}</p>
                      </div>
                      <div className="border border-border p-3">
                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Amount</p>
                        <p className="font-mono font-bold text-[#c2b59b]">{result.amount?.value} {result.amount?.currency}</p>
                      </div>
                      <div className="border border-border p-3">
                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Ledger</p>
                        <p className="font-mono text-[11px]">#{result.ledgerIndex?.toLocaleString()}</p>
                      </div>
                      {result.fee && (
                        <div className="border border-border p-3">
                          <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Fee</p>
                          <p className="font-mono text-[11px]">{result.fee}</p>
                        </div>
                      )}
                      {result.date && (
                        <div className="border border-border p-3">
                          <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Timestamp</p>
                          <p className="font-mono text-[11px]">{new Date(result.date).toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    {result.explorerUrl && (
                      <a href={result.explorerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] font-mono text-[#b45534] hover:opacity-80">
                        <ExternalLink className="h-3 w-3" /> View on XRPL Explorer
                      </a>
                    )}
                  </CardContent>
                </Card>

                {result.memo && result.memo.decoded && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <Card className="surface border-[#c4893b]/20">
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4 text-[#c4893b]" />
                          <p className="font-bold text-sm">Cryptographic Receipt Proof</p>
                          <span className="ml-auto text-[9px] font-mono text-[#c4893b] border border-[#c4893b]/20 px-2 py-0.5">MEMO</span>
                        </div>

                        <div className="border border-border p-3">
                          <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Decoded Memo</p>
                          <p className="font-mono text-[10px] break-all">{result.memo.decoded}</p>
                        </div>

                        {result.memo.receiptProofs.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Verification Chain</p>
                            {result.memo.receiptProofs.map((proof, i) => (
                              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.1 }} className="space-y-2">
                                <div className="flex items-center gap-2 border border-[#c4893b]/10 px-3 py-2">
                                  <Globe className="h-3.5 w-3.5 text-[#c4893b] flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[9px] font-mono text-[#c4893b] uppercase tracking-widest">IPFS CID</p>
                                    <p className="text-[10px] font-mono truncate">{proof.cid}</p>
                                  </div>
                                  <CheckCircle className="h-3.5 w-3.5 text-[#6b7c5e]" />
                                </div>
                                {proof.hash && (
                                  <>
                                    <div className="flex justify-center"><ArrowRight className="h-3 w-3 text-muted-foreground rotate-90" /></div>
                                    <div className="flex items-center gap-2 border border-border px-3 py-2">
                                      <Fingerprint className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">SHA-256 Hash</p>
                                        <p className="text-[10px] font-mono truncate">{proof.hash}</p>
                                      </div>
                                      <CheckCircle className="h-3.5 w-3.5 text-[#6b7c5e]" />
                                    </div>
                                  </>
                                )}
                              </motion.div>
                            ))}
                          </div>
                        )}

                        <div className="border border-[#6b7c5e]/10 p-3 text-[10px] text-muted-foreground">
                          <p className="font-semibold text-[#6b7c5e] font-mono uppercase tracking-widest mb-1">What this proves</p>
                          <ul className="space-y-0.5 list-disc list-inside">
                            <li>Receipt image stored on IPFS (content-addressed, immutable)</li>
                            <li>SHA-256 hash of extracted data embedded in on-chain transaction</li>
                            <li>Anyone can fetch from IPFS and verify the hash matches</li>
                            <li>No party can alter the receipt after settlement</li>
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
