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
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="border-[#c4893b]/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-[#c4893b] flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-sm text-[#c4893b]">
                Duplicate Receipt Detected
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono text-[#c4893b]">
                  {(similarity * 100).toFixed(1)}%
                </span>{" "}
                match via Pinata vector analysis. Blocked to prevent double-counting.
              </p>
              {matchCid && (
                <div className="flex items-center gap-2 mt-2">
                  <Copy className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-[10px] text-muted-foreground truncate">
                    {matchCid}
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
