"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Copy } from "lucide-react";

export function DuplicateWarning({
  similarity,
  matchCid,
}: {
  similarity: number;
  matchCid?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <Card className="border-[#f59e0b]/30 bg-[#f59e0b]/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-[#f59e0b] flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-[#f59e0b]">
                Duplicate Receipt Detected
              </p>
              <p className="text-sm text-muted-foreground">
                This receipt has a{" "}
                <span className="font-mono text-[#f59e0b]">
                  {(similarity * 100).toFixed(1)}%
                </span>{" "}
                similarity match via Pinata vector analysis. It has been blocked
                to prevent double-counting.
              </p>
              {matchCid && (
                <div className="flex items-center gap-2 mt-2">
                  <Copy className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-xs text-muted-foreground truncate">
                    Match: {matchCid}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
