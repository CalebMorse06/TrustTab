import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { PinataSDK } from "pinata";

function getPinata(): PinataSDK {
  return new PinataSDK({
    pinataJwt: process.env.PINATA_JWT!,
    pinataGateway: process.env.PINATA_GATEWAY!,
  });
}

export async function POST(request: NextRequest) {
  try {
    const { tripId } = await request.json();

    const trip = store.getTrip(tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (!trip.settlementStatus?.obligations) {
      return NextResponse.json({ error: "No settlement data" }, { status: 400 });
    }

    const pinata = getPinata();
    const obligations = trip.settlementStatus.obligations;
    const gateway = process.env.PINATA_GATEWAY || "gateway.pinata.cloud";

    // Build master audit report
    const auditReport = {
      type: "TrustTab Settlement Audit",
      version: "1.0",
      tripId: trip.id,
      tripName: trip.name,
      createdAt: new Date().toISOString(),
      settledAt: trip.settlementStatus.completedAt,
      participants: trip.participants.map((p) => ({
        id: p.id,
        name: p.name,
        walletAddress: p.wallet.address,
      })),
      expenses: trip.expenses.map((e) => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        paidBy: trip.participants.find((p) => p.id === e.paidBy)?.name,
        receiptCid: e.receipt?.pinataCid || null,
        receiptGatewayUrl: e.receipt?.gatewayUrl || null,
        extractedData: e.receipt?.extractedData || null,
      })),
      transactions: obligations.map((o) => ({
        from: o.fromName,
        fromAddress: o.fromAddress,
        to: o.toName,
        toAddress: o.toAddress,
        amount: o.rlusdAmount,
        currency: "XRP",
        txHash: o.txHash,
        status: o.status,
        explorerUrl: o.explorerUrl,
        memo: o.memo,
      })),
      approvals: trip.approvals || {},
      summary: {
        totalExpenses: trip.expenses.reduce((s, e) => s + e.amount, 0),
        totalTransactions: obligations.length,
        confirmedTransactions: obligations.filter((o) => o.status === "confirmed").length,
        receiptCount: trip.expenses.filter((e) => e.receipt?.pinataCid).length,
        participantCount: trip.participants.length,
      },
    };

    // Pin master audit report
    const auditBlob = new Blob([JSON.stringify(auditReport, null, 2)], { type: "application/json" });
    const auditFile = new File([auditBlob], `trusttab-audit-${trip.id}.json`, { type: "application/json" });
    const auditResult = await pinata.upload.public.file(auditFile).name(`TrustTab Audit: ${trip.name}`).keyvalues({
      tripId: trip.id,
      type: "audit-report",
      settled: trip.settlementStatus.completedAt || "",
    });

    // Pin per-participant settlement receipts
    const participantCids: Record<string, string> = {};

    for (const participant of trip.participants) {
      const myObligations = obligations.filter(
        (o) => o.from === participant.id || o.to === participant.id
      );

      const participantReceipt = {
        type: "TrustTab Personal Settlement Receipt",
        version: "1.0",
        participant: {
          name: participant.name,
          walletAddress: participant.wallet.address,
        },
        trip: {
          id: trip.id,
          name: trip.name,
          settledAt: trip.settlementStatus.completedAt,
        },
        transactions: myObligations.map((o) => {
          const isSender = o.from === participant.id;
          return {
            direction: isSender ? "sent" : "received",
            counterparty: isSender ? o.toName : o.fromName,
            counterpartyAddress: isSender ? o.toAddress : o.fromAddress,
            amount: o.rlusdAmount,
            currency: "XRP",
            txHash: o.txHash,
            status: o.status,
            explorerUrl: o.explorerUrl,
          };
        }),
        relatedReceipts: trip.expenses
          .filter((e) => e.receipt?.pinataCid)
          .map((e) => ({
            description: e.description,
            amount: e.amount,
            cid: e.receipt!.pinataCid,
            gatewayUrl: e.receipt?.gatewayUrl || null,
          })),
        netAmount: myObligations.reduce((sum, o) => {
          if (o.from === participant.id) return sum - o.rlusdAmount;
          return sum + o.rlusdAmount;
        }, 0),
        approval: trip.approvals?.[participant.id] || null,
        auditReportCid: auditResult.cid,
      };

      const blob = new Blob([JSON.stringify(participantReceipt, null, 2)], { type: "application/json" });
      const file = new File([blob], `trusttab-receipt-${participant.id}-${trip.id}.json`, { type: "application/json" });
      const result = await pinata.upload.public.file(file).name(`TrustTab Receipt: ${participant.name} - ${trip.name}`).keyvalues({
        tripId: trip.id,
        participantId: participant.id,
        type: "participant-receipt",
      });

      participantCids[participant.id] = result.cid;
    }

    // Update trip with CIDs
    trip.settlementStatus.auditCid = auditResult.cid;
    trip.settlementStatus.participantCids = participantCids;
    store.setTrip(trip);

    return NextResponse.json({
      tripId: trip.id,
      auditCid: auditResult.cid,
      auditUrl: `https://${gateway}/ipfs/${auditResult.cid}`,
      participantCids,
      participantUrls: Object.fromEntries(
        Object.entries(participantCids).map(([id, cid]) => [id, `https://${gateway}/ipfs/${cid}`])
      ),
    });
  } catch (error) {
    console.error("Audit report error:", error);
    return NextResponse.json(
      { error: "Audit report failed: " + (error instanceof Error ? error.message : "unknown") },
      { status: 500 }
    );
  }
}
