import { NextRequest, NextResponse } from "next/server";
import { uploadReceipt, getGatewayUrl } from "@/lib/pinata";
import { extractReceiptData } from "@/lib/ai";
import { ReceiptArtifact } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 1. Upload to Pinata (includes CID-based duplicate detection)
    const { cid, fileId, isDuplicate } = await uploadReceipt(file);

    if (isDuplicate) {
      return NextResponse.json(
        {
          isDuplicate: true,
          similarity: 1.0,
          matchCid: cid,
          cid,
          gatewayUrl: getGatewayUrl(cid),
        },
        { status: 409 }
      );
    }

    // 2. Extract receipt data with AI
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    let extractedData = null;
    try {
      extractedData = await extractReceiptData(base64, file.type);
    } catch (error) {
      console.error("AI extraction failed:", error);
    }

    const artifact: ReceiptArtifact = {
      pinataCid: cid,
      pinataFileId: fileId,
      fileName: file.name,
      mimeType: file.type,
      extractedData,
    };

    return NextResponse.json({
      ...artifact,
      gatewayUrl: getGatewayUrl(cid),
      isDuplicate: false,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
