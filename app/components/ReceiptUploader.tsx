"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileImage, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { ReceiptArtifact, ExtractedReceipt } from "@/lib/types";
import { DuplicateWarning } from "./DuplicateWarning";

interface UploadResult {
  artifact: ReceiptArtifact;
  isDuplicate: boolean;
  similarity?: number;
  matchCid?: string;
  gatewayUrl?: string;
}

export function ReceiptUploader({
  onUploadComplete,
}: {
  onUploadComplete: (result: UploadResult) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ similarity: number; matchCid?: string } | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file");
        return;
      }
      setError(null); setDuplicate(null); setSuccess(false); setExtractedData(null);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (res.status === 409) {
          setDuplicate({ similarity: data.similarity, matchCid: data.matchCid });
          setUploading(false);
          return;
        }
        if (!res.ok) throw new Error(data.error || "Upload failed");
        setExtractedData(data.extractedData);
        setSuccess(true);
        onUploadComplete({
          artifact: { pinataCid: data.pinataCid, pinataFileId: data.pinataFileId, fileName: data.fileName, mimeType: data.mimeType, extractedData: data.extractedData },
          isDuplicate: false,
          gatewayUrl: data.gatewayUrl,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onUploadComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) handleFile(file); },
    [handleFile]
  );

  return (
    <div className="space-y-4">
      <motion.div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        animate={{
          borderColor: dragOver ? "#b45534" : "#2e2b29",
          backgroundColor: dragOver ? "rgba(180,85,52,0.03)" : "transparent",
        }}
        className="border-2 border-dashed p-8 text-center cursor-pointer"
        onClick={() => document.getElementById("receipt-input")?.click()}
      >
        <input id="receipt-input" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-[#c4893b] animate-spin" />
            <p className="text-sm text-muted-foreground">Uploading to Pinata and extracting...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">Drop receipt image here</p>
              <p className="text-xs text-muted-foreground">or click to browse</p>
            </div>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Card className="surface overflow-hidden">
              <CardContent className="py-4">
                <div className="flex gap-4">
                  <div className="w-28 h-36 overflow-hidden bg-secondary flex-shrink-0">
                    <img src={preview} alt="Receipt" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 space-y-2">
                    {extractedData ? (
                      <>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-3.5 w-3.5 text-[#6b7c5e]" />
                          <span className="text-xs font-mono text-[#6b7c5e] uppercase">Extracted</span>
                        </div>
                        <p className="font-semibold">{extractedData.vendor}</p>
                        <p className="text-xs text-muted-foreground font-mono">{extractedData.date}</p>
                        <div className="text-xs space-y-0.5">
                          {extractedData.lineItems.slice(0, 3).map((item, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="truncate mr-2">{item.name}</span>
                              <span className="font-mono">${item.price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-base font-mono font-bold text-[#c2b59b]">
                          Total: ${extractedData.total.toFixed(2)}
                        </p>
                      </>
                    ) : uploading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span className="text-xs text-muted-foreground">AI reading receipt...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <FileImage className="h-3.5 w-3.5" />
                        <span className="text-xs text-muted-foreground">Ready</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {duplicate && <DuplicateWarning similarity={duplicate.similarity} matchCid={duplicate.matchCid} />}

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-[#b45534] text-sm">
          <AlertTriangle className="h-4 w-4" />{error}
        </motion.div>
      )}
    </div>
  );
}
