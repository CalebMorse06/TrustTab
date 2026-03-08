"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Trip } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReceiptUploader } from "@/app/components/ReceiptUploader";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export default function UploadPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params);
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [receipt, setReceipt] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/trips/${tripId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setTrip(data);
        if (data?.participants[0]) setPaidBy(data.participants[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tripId]);

  const saveExpense = async () => {
    if (!description || !amount || !paidBy) return;
    setSaving(true);
    try {
      await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, paidBy, description, amount: parseFloat(amount), splitType: "equal", receipt: receipt?.artifact || null }),
      });
      router.push(`/trip/${tripId}`);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  if (loading || !trip) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading...</div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <Link href={`/trip/${tripId}`} className="inline-flex items-center text-muted-foreground hover:text-foreground text-xs font-mono">
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
      </Link>

      <div>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mb-2">Receipt Upload</p>
        <h1 className="text-2xl font-bold">Upload Receipt</h1>
      </div>

      <ReceiptUploader
        onUploadComplete={(result) => {
          setReceipt(result);
          if (result.artifact.extractedData) {
            const data = result.artifact.extractedData;
            if (!description && data.vendor !== "Unknown") setDescription(data.vendor);
            if (!amount && data.total > 0) setAmount(data.total.toString());
          }
        }}
      />

      <Card className="surface">
        <CardContent className="p-5 space-y-4">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Expense Details</p>
          <div>
            <Label htmlFor="description" className="text-[10px] font-mono text-muted-foreground uppercase">Description</Label>
            <Input id="description" placeholder="Dinner at Joe's" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="amount" className="text-[10px] font-mono text-muted-foreground uppercase">Amount ($)</Label>
            <Input id="amount" type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="paidBy" className="text-[10px] font-mono text-muted-foreground uppercase">Paid By</Label>
            <select id="paidBy" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm font-mono">
              {trip.participants.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={saveExpense} disabled={saving || !description || !amount} className="bg-[#b45534] hover:bg-[#9a4529] text-white border-0">
              {saving ? "Saving..." : "Save Expense"} <Save className="ml-2 h-4 w-4" />
            </Button>
            <Link href={`/trip/${tripId}`}><Button variant="ghost">Cancel</Button></Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
