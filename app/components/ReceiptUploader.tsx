"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const [duplicate, setDuplicate] = useState<{
    similarity: number;
    matchCid?: string;
  } | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file");
        return;
      }

      setError(null);
      setDuplicate(null);
      setSuccess(false);
      setExtractedData(null);

      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);

      // Upload
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (res.status === 409) {
          // Duplicate detected
          setDuplicate({
            similarity: data.similarity,
            matchCid: data.matchCid,
          });
          setUploading(false);
          return;
        }

        if (!res.ok) {
          throw new Error(data.error || "Upload failed");
        }

        setExtractedData(data.extractedData);
        setSuccess(true);

        onUploadComplete({
          artifact: {
            pinataCid: data.pinataCid,
            pinataFileId: data.pinataFileId,
            fileName: data.fileName,
            mimeType: data.mimeType,
            extractedData: data.extractedData,
          },
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
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        animate={{
          borderColor: dragOver ? "#10b981" : "rgba(255,255,255,0.08)",
          backgroundColor: dragOver
            ? "rgba(16,185,129,0.05)"
            : "transparent",
        }}
        className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
        onClick={() => document.getElementById("receipt-input")?.click()}
      >
        <input
          id="receipt-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleInputChange}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 text-[#10b981] animate-spin" />
            <p className="text-muted-foreground">
              Uploading to Pinata & extracting data...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Drop receipt image here</p>
              <p className="text-sm text-muted-foreground">
                or click to browse
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Preview + Extraction */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="glass-card overflow-hidden">
              <CardContent className="py-4">
                <div className="flex gap-4">
                  {/* Image preview */}
                  <div className="w-32 h-40 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                    <img
                      src={preview}
                      alt="Receipt"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Extracted data */}
                  <div className="flex-1 space-y-2">
                    {extractedData ? (
                      <>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-[#10b981]" />
                          <span className="text-sm font-medium text-[#10b981]">
                            Data Extracted
                          </span>
                        </div>
                        <p className="font-semibold">{extractedData.vendor}</p>
                        <p className="text-sm text-muted-foreground">
                          {extractedData.date}
                        </p>
                        <div className="text-sm space-y-0.5">
                          {extractedData.lineItems.slice(0, 3).map((item, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="truncate mr-2">{item.name}</span>
                              <span>${item.price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-lg font-bold text-[#10b981]">
                          Total: ${extractedData.total.toFixed(2)}
                        </p>
                      </>
                    ) : uploading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">
                          AI is reading your receipt...
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <FileImage className="h-4 w-4" />
                        <span className="text-sm text-muted-foreground">
                          Ready to upload
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duplicate Warning */}
      {duplicate && (
        <DuplicateWarning
          similarity={duplicate.similarity}
          matchCid={duplicate.matchCid}
        />
      )}

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 text-red-400 text-sm"
        >
          <AlertTriangle className="h-4 w-4" />
          {error}
        </motion.div>
      )}
    </div>
  );
}
