import { PinataSDK } from "pinata";

let pinataClient: PinataSDK | null = null;

function getPinata(): PinataSDK {
  if (!pinataClient) {
    pinataClient = new PinataSDK({
      pinataJwt: process.env.PINATA_JWT!,
      pinataGateway: process.env.PINATA_GATEWAY!,
    });
  }
  return pinataClient;
}

// Track uploaded CIDs in-memory for duplicate detection
const uploadedCids = new Set<string>();

export async function uploadReceipt(
  file: File
): Promise<{ cid: string; fileId: string; isDuplicate: boolean }> {
  const pinata = getPinata();
  const result = await pinata.upload.private.file(file);

  const isDuplicate = uploadedCids.has(result.cid);
  uploadedCids.add(result.cid);

  return {
    cid: result.cid,
    fileId: result.id,
    isDuplicate,
  };
}

export async function vectorDuplicateCheck(
  groupId: string,
  query: string
): Promise<{ isDuplicate: boolean; similarity: number; matchCid?: string }> {
  try {
    const pinata = getPinata();
    const queryResult = await pinata.files.private.queryVectors({
      groupId,
      query,
    });

    if ("matches" in queryResult && queryResult.matches?.length > 0) {
      const topMatch = queryResult.matches[0];
      if (topMatch.score > 0.999) {
        return {
          isDuplicate: true,
          similarity: topMatch.score,
          matchCid: (topMatch as any).cid,
        };
      }
    }

    return { isDuplicate: false, similarity: 0 };
  } catch {
    return { isDuplicate: false, similarity: 0 };
  }
}

export function getGatewayUrl(cid: string): string {
  const gateway = process.env.PINATA_GATEWAY || "gateway.pinata.cloud";
  return `https://${gateway}/ipfs/${cid}`;
}
