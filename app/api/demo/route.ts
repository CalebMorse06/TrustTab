import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { Trip, Expense } from "@/lib/types";
import { generateFundedWallet, disconnectClient } from "@/lib/xrpl";

export async function POST() {
  try {
    store.clear();

    const trip: Trip = {
      id: "demo-austin-2026",
      name: "Austin Spring Break 2026",
      participants: [
        { id: "alice", name: "Alice", avatar: "A", wallet: { address: "", seed: "" } },
        { id: "bob", name: "Bob", avatar: "B", wallet: { address: "", seed: "" } },
        { id: "charlie", name: "Charlie", avatar: "C", wallet: { address: "", seed: "" } },
        { id: "diana", name: "Diana", avatar: "D", wallet: { address: "", seed: "" } },
      ],
      expenses: [],
      status: "active",
      createdAt: new Date().toISOString(),
    };

    const expense1: Expense = {
      id: "exp-bbq",
      tripId: trip.id,
      paidBy: "alice",
      description: "Franklin BBQ",
      amount: 142.5,
      splitType: "equal",
      splits: [
        { participantId: "alice", amount: 35.63, settled: false },
        { participantId: "bob", amount: 35.63, settled: false },
        { participantId: "charlie", amount: 35.63, settled: false },
        { participantId: "diana", amount: 35.61, settled: false },
      ],
      receipt: {
        pinataCid: "bafkreidemo1",
        pinataFileId: "demo-file-1",
        fileName: "franklin_bbq_receipt.jpg",
        mimeType: "image/jpeg",
        extractedData: {
          vendor: "Franklin Barbecue",
          date: "2026-03-14",
          lineItems: [
            { name: "Brisket (1 lb)", quantity: 2, price: 32.0 },
            { name: "Pulled Pork", quantity: 1, price: 18.5 },
            { name: "Mac & Cheese", quantity: 2, price: 12.0 },
            { name: "Sweet Tea", quantity: 4, price: 16.0 },
            { name: "Pecan Pie", quantity: 2, price: 14.0 },
          ],
          subtotal: 120.5,
          tax: 9.94,
          tip: 12.06,
          total: 142.5,
          confidence: 0.95,
        },
      },
      status: "pending",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    };

    const expense2: Expense = {
      id: "exp-uber",
      tripId: trip.id,
      paidBy: "bob",
      description: "Uber to 6th Street",
      amount: 38.75,
      splitType: "equal",
      splits: [
        { participantId: "alice", amount: 9.69, settled: false },
        { participantId: "bob", amount: 9.69, settled: false },
        { participantId: "charlie", amount: 9.69, settled: false },
        { participantId: "diana", amount: 9.68, settled: false },
      ],
      receipt: {
        pinataCid: "bafkreidemo2",
        pinataFileId: "demo-file-2",
        fileName: "uber_receipt.jpg",
        mimeType: "image/jpeg",
        extractedData: {
          vendor: "Uber",
          date: "2026-03-14",
          lineItems: [
            { name: "UberXL Ride", quantity: 1, price: 32.5 },
            { name: "Tip", quantity: 1, price: 6.25 },
          ],
          subtotal: 32.5,
          tax: 0.0,
          tip: 6.25,
          total: 38.75,
          confidence: 0.98,
        },
      },
      status: "pending",
      createdAt: new Date(Date.now() - 43200000).toISOString(),
    };

    trip.expenses = [expense1, expense2];
    store.setTrip(trip);
    store.setExpense(expense1);
    store.setExpense(expense2);

    // Fund wallets for all participants
    const walletResults: { name: string; address: string; funded: boolean }[] = [];
    for (const participant of trip.participants) {
      try {
        const wallet = await generateFundedWallet();
        participant.wallet = wallet;
        walletResults.push({ name: participant.name, address: wallet.address, funded: true });
      } catch (error) {
        console.error("Wallet funding failed for", participant.name, error);
        walletResults.push({ name: participant.name, address: "", funded: false });
      }
    }

    store.setTrip(trip);
    await disconnectClient();

    const allFunded = walletResults.every((w) => w.funded);

    return NextResponse.json({
      tripId: trip.id,
      walletsReady: allFunded,
      wallets: walletResults,
      expenses: trip.expenses.length,
    });
  } catch (error) {
    console.error("Demo setup error:", error);
    await disconnectClient();
    return NextResponse.json(
      { error: "Demo setup failed: " + (error instanceof Error ? error.message : "unknown") },
      { status: 500 }
    );
  }
}
