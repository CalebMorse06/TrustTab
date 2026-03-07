"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Plane, X, ArrowRight, Sparkles, Receipt, Zap, Shield,
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
    <div className="space-y-10 py-4">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16"
      >
        {/* Animated logo coins */}
        <div className="flex justify-center gap-3 mb-6">
          {["🧾", "🪙", "✅"].map((emoji, i) => (
            <motion.div
              key={i}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.15, type: "spring", stiffness: 200 }}
              className="text-4xl"
            >
              {emoji}
            </motion.div>
          ))}
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-6xl font-extrabold mb-4 tracking-tight"
        >
          <span className="text-gradient">Trip Treasury</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-muted-foreground text-xl max-w-lg mx-auto leading-relaxed"
        >
          Upload a receipt. AI reads it. Everyone gets charged on-chain.
          <br />
          <span className="text-foreground font-medium">No math. No disputes. No trust required.</span>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="flex gap-2 justify-center mt-6"
        >
          <Badge variant="outline" className="text-[#10b981] border-[#10b981]/30 px-3 py-1">
            <Zap className="h-3 w-3 mr-1" /> XRPL RLUSD
          </Badge>
          <Badge variant="outline" className="text-[#f59e0b] border-[#f59e0b]/30 px-3 py-1">
            <Shield className="h-3 w-3 mr-1" /> Pinata IPFS
          </Badge>
          <Badge variant="outline" className="text-[#3b82f6] border-[#3b82f6]/30 px-3 py-1">
            <Receipt className="h-3 w-3 mr-1" /> GPT-4o Vision
          </Badge>
        </motion.div>
      </motion.div>

      {/* How it works — visual pipeline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
        className="grid grid-cols-3 gap-4 max-w-2xl mx-auto"
      >
        {[
          { step: "1", icon: "📸", title: "Snap Receipt", desc: "Upload any receipt image", color: "#f59e0b" },
          { step: "2", icon: "🧠", title: "AI Extracts", desc: "GPT-4o reads items & total", color: "#3b82f6" },
          { step: "3", icon: "⚡", title: "Settle On-Chain", desc: "RLUSD payments on XRPL", color: "#10b981" },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 + i * 0.15 }}
            className="text-center space-y-2"
          >
            <div className="text-4xl">{s.icon}</div>
            <p className="font-bold" style={{ color: s.color }}>{s.title}</p>
            <p className="text-xs text-muted-foreground">{s.desc}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
      >
        {!showCreate ? (
          <div className="flex justify-center gap-3">
            <Button
              size="lg"
              onClick={() => setShowCreate(true)}
              className="gradient-emerald text-white border-0 text-lg px-8 py-6"
            >
              <Plus className="mr-2 h-5 w-5" /> New Trip
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={seedDemo}
              disabled={seeding}
              className="border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/10 text-lg px-8 py-6"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              {seeding ? "Loading..." : "Live Demo"}
            </Button>
            <Link href="/verify">
              <Button
                size="lg"
                variant="outline"
                className="border-[#3b82f6]/30 text-[#3b82f6] hover:bg-[#3b82f6]/10 text-lg px-8 py-6"
              >
                <Shield className="mr-2 h-5 w-5" />
                Verify TX
              </Button>
            </Link>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-lg mx-auto"
          >
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plane className="h-5 w-5 text-[#10b981]" />
                  Create a Trip
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="tripName">Trip Name</Label>
                  <Input
                    id="tripName"
                    placeholder="Austin Spring Break 2026"
                    value={tripName}
                    onChange={(e) => setTripName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Participants</Label>
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
                    className="mt-2 text-[#10b981]"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Person
                  </Button>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={createTrip}
                    disabled={creating}
                    className="gradient-emerald text-white border-0"
                  >
                    {creating ? "Creating..." : "Create Trip"}
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
        <div className="space-y-3 max-w-lg mx-auto">
          <h2 className="text-xl font-semibold">Your Trips</h2>
          {trips.map((trip) => (
            <motion.div
              key={trip.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <Card
                className="glass-card cursor-pointer hover:border-[#10b981]/30 transition-colors"
                onClick={() => router.push(`/trip/${trip.id}`)}
              >
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {trip.participants.slice(0, 3).map((p) => (
                        <div
                          key={p.id}
                          className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm border-2 border-[#111638]"
                        >
                          {p.avatar}
                        </div>
                      ))}
                      {trip.participants.length > 3 && (
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] border-2 border-[#111638] text-muted-foreground">
                          +{trip.participants.length - 3}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold">{trip.name}</h3>
                      <p className="text-muted-foreground text-xs">
                        {trip.participants.length} people &middot;{" "}
                        {trip.expenses.length} expenses
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={trip.status === "settled" ? "default" : "outline"}
                      className={
                        trip.status === "settled"
                          ? "bg-[#10b981] text-white"
                          : "text-[#f59e0b] border-[#f59e0b]/30"
                      }
                    >
                      {trip.status === "settled" ? "Settled" : "Active"}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
