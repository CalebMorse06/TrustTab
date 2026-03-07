import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { Expense } from "@/lib/types";
import { createEqualSplits } from "@/lib/splits";
import { nanoid } from "nanoid";

export async function GET(request: NextRequest) {
  const tripId = request.nextUrl.searchParams.get("tripId");
  if (!tripId) {
    return NextResponse.json({ error: "tripId required" }, { status: 400 });
  }
  const expenses = store.getExpensesByTrip(tripId);
  return NextResponse.json(expenses);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tripId, paidBy, description, amount, splitType, receipt } = body;

  const trip = store.getTrip(tripId);
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const participantIds = trip.participants.map((p) => p.id);

  const expense: Expense = {
    id: nanoid(8),
    tripId,
    paidBy,
    description,
    amount: Number(amount),
    splitType: splitType || "equal",
    splits: createEqualSplits(Number(amount), participantIds),
    receipt: receipt || null,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  store.setExpense(expense);
  return NextResponse.json(expense, { status: 201 });
}
