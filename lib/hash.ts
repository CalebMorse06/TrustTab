import { createHash } from "crypto";
import { ExtractedReceipt } from "./types";

/**
 * Creates a deterministic SHA-256 hash of extracted receipt data.
 * This hash gets stored on-chain in the XRPL transaction memo,
 * creating a verifiable link: Receipt Image (IPFS) → Data Hash (on-chain) → Payment (on-chain)
 */
export function hashReceiptData(data: ExtractedReceipt): string {
  // Canonical JSON — sorted keys for deterministic output
  const canonical = JSON.stringify({
    vendor: data.vendor,
    date: data.date,
    lineItems: data.lineItems.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      price: i.price,
    })),
    subtotal: data.subtotal,
    tax: data.tax,
    tip: data.tip,
    total: data.total,
  });

  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Creates a combined memo payload: CID + data hash
 * Format: "ipfs:<cid>|sha256:<hash>"
 */
export function buildMemoPayload(
  cid: string,
  receiptHash?: string
): string {
  let memo = `ipfs:${cid}`;
  if (receiptHash) {
    memo += `|sha256:${receiptHash}`;
  }
  return memo;
}

/**
 * Parses a memo payload back into components
 */
export function parseMemoPayload(memo: string): {
  cids: string[];
  hashes: string[];
} {
  const cids: string[] = [];
  const hashes: string[] = [];

  const parts = memo.split(",");
  for (const part of parts) {
    const segments = part.split("|");
    for (const seg of segments) {
      if (seg.startsWith("ipfs:")) {
        cids.push(seg.replace("ipfs:", ""));
      } else if (seg.startsWith("sha256:")) {
        hashes.push(seg.replace("sha256:", ""));
      } else if (seg.startsWith("bafy") || seg.startsWith("bafk")) {
        // Raw CID without prefix
        cids.push(seg);
      }
    }
  }

  return { cids, hashes };
}

/**
 * Verify that receipt data matches a given hash
 */
export function verifyReceiptHash(
  data: ExtractedReceipt,
  expectedHash: string
): boolean {
  return hashReceiptData(data) === expectedHash;
}
