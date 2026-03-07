import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { generateFundedWallet, disconnectClient } from "@/lib/xrpl";

export async function POST(request: NextRequest) {
  try {
    const { tripId } = await request.json();

    const trip = store.getTrip(tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const results: {
      participantId: string;
      name: string;
      address: string;
      funded: boolean;
      xrpBalance?: number;
    }[] = [];

    for (const participant of trip.participants) {
      // Skip if already has a wallet
      if (participant.wallet.address) {
        results.push({
          participantId: participant.id,
          name: participant.name,
          address: participant.wallet.address,
          funded: true,
        });
        continue;
      }

      try {
        const wallet = await generateFundedWallet();
        participant.wallet = wallet;
        results.push({
          participantId: participant.id,
          name: participant.name,
          address: wallet.address,
          funded: true,
          xrpBalance: 100,
        });
        console.log(`Funded wallet for ${participant.name}: ${wallet.address}`);
      } catch (error) {
        console.error("Wallet generation failed for", participant.name, error);
        results.push({
          participantId: participant.id,
          name: participant.name,
          address: "",
          funded: false,
        });
      }
    }

    // Save updated trip
    store.setTrip(trip);
    await disconnectClient();

    const allFunded = results.every((r) => r.funded);

    return NextResponse.json({
      tripId,
      wallets: results,
      allFunded,
    });
  } catch (error) {
    console.error("Wallet generation error:", error);
    await disconnectClient();
    return NextResponse.json(
      { error: "Wallet generation failed: " + (error instanceof Error ? error.message : "unknown") },
      { status: 500 }
    );
  }
}
