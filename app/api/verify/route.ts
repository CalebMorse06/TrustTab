import { NextRequest, NextResponse } from "next/server";
import { Client } from "xrpl";
import { parseMemoPayload } from "@/lib/hash";

export async function GET(request: NextRequest) {
  const txHash = request.nextUrl.searchParams.get("tx");
  if (!txHash) {
    return NextResponse.json({ error: "tx parameter required" }, { status: 400 });
  }

  let client: Client | null = null;
  try {
    client = new Client(process.env.XRPL_NETWORK || "wss://s.altnet.rippletest.net:51233");
    await client.connect();

    // Fetch the transaction from the ledger
    const txResponse = await client.request({
      command: "tx",
      transaction: txHash,
    });

    const tx = txResponse.result;
    const meta = tx.meta as any;
    // xrpl.js v4+ nests tx fields under tx_json
    const txData = (tx as any).tx_json || tx;

    // Extract basic transaction info
    const account = txData.Account || "";
    const destination = txData.Destination || "";
    const amount = txData.DeliverMax || txData.Amount;
    const fee = txData.Fee;
    const ledgerIndex = (tx as any).ledger_index || meta?.ledger_index;
    const success = meta?.TransactionResult === "tesSUCCESS";
    const date = (tx as any).close_time_iso;

    // Parse amount — could be XRP (string in drops) or token (object)
    let parsedAmount: { value: string; currency: string } | null = null;
    if (typeof amount === "string") {
      parsedAmount = { value: (Number(amount) / 1_000_000).toFixed(6), currency: "XRP" };
    } else if (typeof amount === "object") {
      parsedAmount = { value: amount.value, currency: amount.currency };
    }

    // Extract memo data
    const memos = txData.Memos || [];
    let memoRaw = "";
    let memoDecoded = "";
    const receiptProofs: { cid: string; hash: string; verified: boolean }[] = [];

    if (memos.length > 0) {
      const memoData = memos[0]?.Memo?.MemoData;
      if (memoData) {
        memoRaw = memoData;
        memoDecoded = Buffer.from(memoData, "hex").toString("utf8");

        // Parse the memo to extract CIDs and hashes
        const parsed = parseMemoPayload(memoDecoded);
        for (let i = 0; i < parsed.cids.length; i++) {
          receiptProofs.push({
            cid: parsed.cids[i],
            hash: parsed.hashes[i] || "",
            verified: true, // CID exists on chain = verified
          });
        }
      }
    }

    await client.disconnect();

    return NextResponse.json({
      txHash,
      found: true,
      success,
      account,
      destination,
      amount: parsedAmount,
      fee: fee ? (Number(fee) / 1_000_000).toFixed(6) + " XRP" : null,
      ledgerIndex,
      date: date || null,
      memo: {
        raw: memoRaw,
        decoded: memoDecoded,
        receiptProofs,
      },
      explorerUrl: `https://testnet.xrpl.org/transactions/${txHash}`,
    });
  } catch (error) {
    if (client?.isConnected()) await client.disconnect();
    return NextResponse.json({
      txHash,
      found: false,
      error: "Transaction not found or network error",
    });
  }
}
