"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

export default function VerifyPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 text-[#10b981] animate-spin" /></div>}>
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

  // Auto-verify if tx param is in URL
  useEffect(() => {
    const tx = searchParams.get("tx");
    if (tx && !autoVerified) {
      setTxHash(tx);
      setAutoVerified(true);
      verifyTx(tx);
    }
  }, [searchParams, autoVerified]);

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

  const verify = () => verifyTx(txHash);

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground text-sm">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Link>
        <NetworkStatus />
      </div>

      <div className="text-center py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-[#10b981]/10 border border-[#10b981]/20 flex items-center justify-center">
              <Shield className="h-8 w-8 text-[#10b981]" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Verify On-Chain</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Paste any XRPL transaction hash to verify the payment and its linked receipt artifacts. Don&apos;t trust — verify.
          </p>
        </motion.div>
      </div>

      {/* Search */}
      <div className="flex gap-2 max-w-2xl mx-auto">
        <Input
          placeholder="Enter XRPL transaction hash..."
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && verify()}
          className="font-mono text-sm"
        />
        <Button onClick={verify} disabled={loading || !txHash.trim()} className="gradient-emerald text-white border-0 px-6">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto space-y-4"
          >
            {!result.found ? (
              <Card className="border-red-500/20">
                <CardContent className="py-6 flex items-center gap-3 justify-center">
                  <XCircle className="h-6 w-6 text-red-400" />
                  <p className="text-red-400 font-medium">Transaction not found on the XRP Ledger</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Transaction Status */}
                <Card className={`glass-card ${result.success ? "border-[#10b981]/20" : "border-red-500/20"}`}>
                  <CardContent className="py-5 space-y-4">
                    <div className="flex items-center gap-3">
                      {result.success ? (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }}>
                          <CheckCircle className="h-8 w-8 text-[#10b981]" />
                        </motion.div>
                      ) : (
                        <XCircle className="h-8 w-8 text-red-400" />
                      )}
                      <div>
                        <p className="text-lg font-bold">{result.success ? "Transaction Verified" : "Transaction Failed"}</p>
                        <p className="text-xs text-muted-foreground">Confirmed on XRP Ledger Testnet</p>
                      </div>
                      <Badge variant="outline" className="ml-auto text-[#10b981] border-[#10b981]/30">
                        <Zap className="h-3 w-3 mr-1" /> On-Chain
                      </Badge>
                    </div>

                    {/* Transaction details grid */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-background/50 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">From</p>
                        <p className="font-mono text-xs truncate">{result.account}</p>
                      </div>
                      <div className="bg-background/50 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">To</p>
                        <p className="font-mono text-xs truncate">{result.destination}</p>
                      </div>
                      <div className="bg-background/50 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Amount</p>
                        <p className="font-bold text-[#10b981]">
                          {result.amount?.value} {result.amount?.currency}
                        </p>
                      </div>
                      <div className="bg-background/50 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Ledger</p>
                        <p className="font-mono text-xs">#{result.ledgerIndex?.toLocaleString()}</p>
                      </div>
                      {result.fee && (
                        <div className="bg-background/50 rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Network Fee</p>
                          <p className="font-mono text-xs">{result.fee}</p>
                        </div>
                      )}
                      {result.date && (
                        <div className="bg-background/50 rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Timestamp</p>
                          <p className="font-mono text-xs">{new Date(result.date).toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    {/* Explorer link */}
                    {result.explorerUrl && (
                      <a href={result.explorerUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-[#10b981] hover:underline">
                        <ExternalLink className="h-3 w-3" /> View on XRPL Explorer
                      </a>
                    )}
                  </CardContent>
                </Card>

                {/* Memo / Receipt Proof Chain */}
                {result.memo && result.memo.decoded && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <Card className="glass-card border-[#f59e0b]/20">
                      <CardContent className="py-5 space-y-4">
                        <div className="flex items-center gap-2">
                          <Lock className="h-5 w-5 text-[#f59e0b]" />
                          <h3 className="font-bold">Cryptographic Receipt Proof</h3>
                          <Badge variant="outline" className="ml-auto text-[#f59e0b] border-[#f59e0b]/30 text-[10px]">
                            Embedded in Memo
                          </Badge>
                        </div>

                        {/* Raw memo decode */}
                        <div className="bg-background/50 rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Decoded Memo Field</p>
                          <p className="font-mono text-xs break-all text-foreground">{result.memo.decoded}</p>
                        </div>

                        {/* Proof chain visualization */}
                        {result.memo.receiptProofs.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Verification Chain</p>
                            {result.memo.receiptProofs.map((proof, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 + i * 0.15 }}
                                className="space-y-2"
                              >
                                {/* IPFS CID */}
                                <div className="flex items-center gap-2 bg-[#f59e0b]/5 border border-[#f59e0b]/10 rounded-lg px-3 py-2">
                                  <Globe className="h-4 w-4 text-[#f59e0b] flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-[#f59e0b] font-bold uppercase tracking-wider">IPFS Content ID</p>
                                    <p className="text-[11px] font-mono text-foreground truncate">{proof.cid}</p>
                                  </div>
                                  <CheckCircle className="h-4 w-4 text-[#10b981] flex-shrink-0" />
                                </div>

                                {/* SHA-256 Hash */}
                                {proof.hash && (
                                  <>
                                    <div className="flex justify-center">
                                      <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                                    </div>
                                    <div className="flex items-center gap-2 bg-[#3b82f6]/5 border border-[#3b82f6]/10 rounded-lg px-3 py-2">
                                      <Fingerprint className="h-4 w-4 text-[#3b82f6] flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] text-[#3b82f6] font-bold uppercase tracking-wider">SHA-256 Data Hash</p>
                                        <p className="text-[11px] font-mono text-foreground truncate">{proof.hash}</p>
                                      </div>
                                      <CheckCircle className="h-4 w-4 text-[#10b981] flex-shrink-0" />
                                    </div>
                                  </>
                                )}
                              </motion.div>
                            ))}
                          </div>
                        )}

                        {/* Explanation */}
                        <div className="bg-[#10b981]/5 border border-[#10b981]/10 rounded-lg p-3 text-xs text-muted-foreground">
                          <p className="font-semibold text-[#10b981] mb-1">What this proves:</p>
                          <ul className="space-y-1 list-disc list-inside">
                            <li>The receipt image is stored on IPFS (content-addressed, immutable)</li>
                            <li>The SHA-256 hash of extracted data is embedded in the on-chain transaction</li>
                            <li>Anyone can fetch the receipt from IPFS and verify the hash matches</li>
                            <li>No party can alter the receipt after settlement without breaking the hash</li>
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
