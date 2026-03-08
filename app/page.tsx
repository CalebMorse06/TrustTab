"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus, X, ArrowRight, Sparkles, Shield, Loader2, Zap, Wallet,
} from "lucide-react";
import Link from "next/link";
import { Trip } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [tripName, setTripName] = useState("");
  const [participants, setParticipants] = useState(["", ""]);
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoStatus, setDemoStatus] = useState("");

  const loadTrips = () => {
    fetch("/api/trips")
      .then((r) => r.json())
      .then(setTrips)
      .catch(console.error);
  };

  useEffect(() => {
    loadTrips();
  }, []);

  const seedDemo = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      router.push(`/trip/${data.tripId}`);
    } catch (e) {
      console.error(e);
      setSeeding(false);
    }
  };

  const launchFullDemo = async () => {
    setDemoLoading(true);
    setDemoStatus("Seeding trip data...");
    try {
      setDemoStatus("Funding XRPL testnet wallets...");
      const res = await fetch("/api/demo", { method: "POST" });
      const data = await res.json();
      if (data.walletsReady) {
        setDemoStatus("Wallets funded. Redirecting...");
        router.push(`/trip/${data.tripId}`);
      } else {
        setDemoStatus("Some wallets failed to fund. Redirecting...");
        router.push(`/trip/${data.tripId}`);
      }
    } catch (e) {
      console.error(e);
      setDemoStatus("Demo setup failed");
      setDemoLoading(false);
    }
  };

  const addParticipant = () => setParticipants([...participants, ""]);
  const removeParticipant = (i: number) =>
    setParticipants(participants.filter((_, idx) => idx !== i));
  const updateParticipant = (i: number, val: string) => {
    const updated = [...participants];
    updated[i] = val;
    setParticipants(updated);
  };

  const createTrip = async () => {
    const names = participants.filter((n) => n.trim());
    if (!tripName.trim() || names.length < 2) return;
    setCreating(true);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tripName, participantNames: names }),
      });
      const trip = await res.json();
      router.push(`/trip/${trip.id}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
    }
  };

  return (
    <div className="space-y-16 py-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-20"
      >
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xs font-mono text-muted-foreground uppercase tracking-[0.3em] mb-6"
        >
          On-chain expense splitting
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-7xl font-extrabold mb-6 tracking-tight text-foreground leading-[0.9]"
        >
          Trust
          <span className="text-[#b45534]">Tab</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-muted-foreground text-lg max-w-md leading-relaxed"
        >
          Upload a receipt. AI reads it. Everyone gets charged on-chain.
          <br />
          <span className="text-foreground font-medium">No math. No disputes. No trust required.</span>
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex gap-4 mt-8 text-xs font-mono text-muted-foreground"
        >
          <span className="border-l-2 border-[#b45534] pl-2">XRPL</span>
          <span className="border-l-2 border-[#6b7c5e] pl-2">Pinata IPFS</span>
          <span className="border-l-2 border-[#c2b59b] pl-2">GPT-4o Vision</span>
        </motion.div>
      </motion.div>

      {/* Pipeline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="grid grid-cols-3 gap-px bg-border max-w-2xl"
      >
        {[
          { step: "01", title: "Capture", desc: "Upload any receipt image", color: "#c4893b" },
          { step: "02", title: "Extract", desc: "GPT-4o reads items and total", color: "#c2b59b" },
          { step: "03", title: "Settle", desc: "XRP payments on-chain", color: "#6b7c5e" },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 + i * 0.1 }}
            className="bg-card p-5 space-y-3"
          >
            <span className="text-xs font-mono" style={{ color: s.color }}>{s.step}</span>
            <p className="font-bold text-lg">{s.title}</p>
            <p className="text-xs text-muted-foreground">{s.desc}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
      >
        {!showCreate ? (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Button
                size="lg"
                onClick={() => setShowCreate(true)}
                className="bg-[#b45534] hover:bg-[#9a4529] text-white border-0 text-base px-8 py-6 font-semibold"
              >
                <Plus className="mr-2 h-4 w-4" /> New Trip
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={seedDemo}
                disabled={seeding || demoLoading}
                className="border-border text-foreground hover:bg-secondary text-base px-8 py-6"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {seeding ? "Loading..." : "Quick Demo"}
              </Button>
              <Link href="/verify">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-border text-muted-foreground hover:bg-secondary text-base px-8 py-6"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Verify
                </Button>
              </Link>
            </div>
            <Button
              size="lg"
              onClick={launchFullDemo}
              disabled={demoLoading || seeding}
              className="bg-[#1c1a19] hover:bg-[#252321] text-[#c4893b] border border-[#c4893b]/30 text-base px-8 py-6 font-semibold w-full max-w-md"
            >
              {demoLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{demoStatus}</>
              ) : (
                <><Wallet className="mr-2 h-4 w-4" />Launch Full Demo<span className="ml-2 text-xs font-mono text-[#c4893b]/60">seed + fund wallets + ready to settle</span></>
              )}
            </Button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg"
          >
            <Card className="surface">
              <CardContent className="p-6 space-y-5">
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">New Trip</p>
                <div>
                  <Label htmlFor="tripName" className="text-xs font-mono text-muted-foreground">Name</Label>
                  <Input
                    id="tripName"
                    placeholder="Austin Spring Break 2026"
                    value={tripName}
                    onChange={(e) => setTripName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Participants</Label>
                  <div className="space-y-2 mt-1">
                    {participants.map((name, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          placeholder={`Person ${i + 1}`}
                          value={name}
                          onChange={(e) => updateParticipant(i, e.target.value)}
                        />
                        {participants.length > 2 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeParticipant(i)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={addParticipant}
                    className="mt-2 text-muted-foreground"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={createTrip}
                    disabled={creating}
                    className="bg-[#b45534] hover:bg-[#9a4529] text-white border-0"
                  >
                    {creating ? "Creating..." : "Create"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button variant="ghost" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>

      {/* Existing Trips */}
      {trips.length > 0 && (
        <div className="space-y-1 max-w-lg">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">Trips</p>
          {trips.map((trip) => (
            <motion.div
              key={trip.id}
              whileHover={{ x: 2 }}
            >
              <div
                className="flex items-center justify-between py-4 px-4 bg-card border border-border cursor-pointer hover:bg-secondary transition-colors"
                onClick={() => router.push(`/trip/${trip.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-1">
                    {trip.participants.slice(0, 3).map((p, i) => (
                      <div
                        key={p.id}
                        className="w-6 h-6 bg-secondary flex items-center justify-center text-[10px] font-mono font-bold border-r border-background"
                        style={{ borderLeft: `2px solid ${["#b45534","#6b7c5e","#c2b59b"][i % 3]}` }}
                      >
                        {p.name.charAt(0)}
                      </div>
                    ))}
                    {trip.participants.length > 3 && (
                      <div className="w-6 h-6 bg-secondary flex items-center justify-center text-[9px] font-mono text-muted-foreground">
                        +{trip.participants.length - 3}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{trip.name}</p>
                    <p className="text-muted-foreground text-[11px] font-mono">
                      {trip.participants.length} people / {trip.expenses.length} expenses
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="text-[10px] font-mono uppercase tracking-wider"
                    style={{ color: trip.status === "settled" ? "#6b7c5e" : "#c4893b" }}
                  >
                    {trip.status}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
