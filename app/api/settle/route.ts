import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { minimizeDebts } from "@/lib/splits";
import { executeSettlement, disconnectClient, getExplorerUrl } from "@/lib/xrpl";
import { hashReceiptData, buildMemoPayload } from "@/lib/hash";

export async function POST(request: NextRequest) {
  try {
    const { tripId } = await request.json();

    const trip = store.getTrip(tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const obligations = minimizeDebts(trip.expenses, trip.participants);

    if (obligations.length === 0) {
      return NextResponse.json({
        tripId, obligations: [], totalTransactions: 0,
        status: "completed", message: "No debts to settle",
      });
    }

    // Build participant wallet map
    const participantMap = new Map<string, { seed: string; address: string }>();
    for (const p of trip.participants) {
      if (p.wallet.address && p.wallet.seed) {
        participantMap.set(p.id, { seed: p.wallet.seed, address: p.wallet.address });
      }
    }

    const missingWallets = obligations.some(
      (o) => !participantMap.has(o.from) || !participantMap.has(o.to)
    );
    if (missingWallets) {
      return NextResponse.json(
        { error: "Not all participants have funded wallets." },
        { status: 400 }
      );
    }

    // Build memo payload: CID + SHA-256 hash of extracted receipt data
    const receiptProofs: { cid: string; hash: string; expense: string }[] = [];
    const memoSegments: string[] = [];

    for (const expense of trip.expenses) {
      if (expense.receipt?.pinataCid) {
        const dataHash = expense.receipt.extractedData
          ? hashReceiptData(expense.receipt.extractedData)
          : "";
        receiptProofs.push({
          cid: expense.receipt.pinataCid,
          hash: dataHash,
          expense: expense.description,
        });
        memoSegments.push(
          buildMemoPayload(expense.receipt.pinataCid, dataHash || undefined)
        );
      }
    }

    const memoPayload = memoSegments.join(",");

    // Mark settlement as in-progress so live view can show it
    trip.settlementStatus = { phase: "processing", startedAt: new Date().toISOString() };
    store.setTrip(trip);

    // Execute XRP payments with cryptographic memo
    const results = await executeSettlement(
      obligations,
      participantMap,
      memoPayload || undefined
    );

    const enrichedObligations = results.map((o) => ({
      ...o,
      fromName: trip.participants.find((p) => p.id === o.from)?.name,
      toName: trip.participants.find((p) => p.id === o.to)?.name,
      fromAddress: participantMap.get(o.from)?.address,
      toAddress: participantMap.get(o.to)?.address,
      explorerUrl: o.txHash ? getExplorerUrl(o.txHash) : undefined,
      memo: memoPayload || undefined,
      currency: "XRP",
    }));

    // Update trip status
    const allConfirmed = results.every((r) => r.status === "confirmed");
    trip.settlementStatus = {
      phase: "complete",
      startedAt: trip.settlementStatus.startedAt,
      completedAt: new Date().toISOString(),
      obligations: enrichedObligations,
    };
    if (allConfirmed) {
      trip.status = "settled";
      trip.expenses.forEach((e) => {
        e.status = "settled";
        e.splits.forEach((s) => (s.settled = true));
      });
    }
    store.setTrip(trip);

    await disconnectClient();

    return NextResponse.json({
      tripId,
      obligations: enrichedObligations,
      receiptProofs,
      totalTransactions: results.length,
      confirmedTransactions: results.filter((r) => r.status === "confirmed").length,
      status: allConfirmed ? "completed" : "partial",
    });
  } catch (error) {
    console.error("Settlement error:", error);
    await disconnectClient();
    return NextResponse.json(
      { error: "Settlement failed: " + (error instanceof Error ? error.message : "unknown") },
      { status: 500 }
    );
  }
}
