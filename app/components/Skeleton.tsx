"use client";

import { motion } from "framer-motion";

export function CardSkeleton() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-border p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-secondary animate-pulse" />
        <div className="space-y-2 flex-1">
          <div className="h-4 w-32 bg-secondary animate-pulse" />
          <div className="h-3 w-24 bg-secondary animate-pulse" />
        </div>
        <div className="h-6 w-16 bg-secondary animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-secondary animate-pulse" />
        <div className="h-3 w-3/4 bg-secondary animate-pulse" />
      </div>
    </motion.div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-4 w-16 bg-secondary animate-pulse" />
        <div className="h-8 w-64 bg-secondary animate-pulse" />
        <div className="h-4 w-40 bg-secondary animate-pulse" />
      </div>
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 bg-secondary animate-pulse" />
            <div className="h-3 w-10 bg-secondary animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <CardSkeleton />
      </div>
    </div>
  );
}
