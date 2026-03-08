"use client";

import { useState, useEffect, use } from "react";
import { motion } from "framer-motion";
import { Trip } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { SettlementView } from "@/app/components/SettlementView";
import { ArrowLeft, Zap } from "lucide-react";
import Link from "next/link";

export default function SettlePage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/trips/${tripId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setTrip(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [tripId]);

  if (loading || !trip) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading...</div>;
  }

  if (trip.expenses.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <Link href={`/trip/${tripId}`} className="inline-flex items-center text-muted-foreground hover:text-foreground text-xs font-mono">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
        </Link>
        <div className="text-center py-12">
          <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">No expenses to settle. Upload some receipts first.</p>
          <Link href={`/trip/${tripId}/upload`}>
            <Button className="mt-4 bg-[#b45534] hover:bg-[#9a4529] text-white border-0">Upload Receipt</Button>
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <Link href={`/trip/${tripId}`} className="inline-flex items-center text-muted-foreground hover:text-foreground text-xs font-mono">
        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
      </Link>

      <div>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mb-2">Settlement</p>
        <h1 className="text-2xl font-bold">Settle Up</h1>
      </div>

      <SettlementView trip={trip} />
    </motion.div>
  );
}
