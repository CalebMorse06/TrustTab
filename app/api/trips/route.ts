import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { Trip, Participant } from "@/lib/types";
import { nanoid } from "nanoid";

export async function GET() {
  const trips = store.getAllTrips();
  return NextResponse.json(trips);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, participantNames } = body as {
    name: string;
    participantNames: string[];
  };

  if (!name || !participantNames?.length) {
    return NextResponse.json(
      { error: "Name and participants required" },
      { status: 400 }
    );
  }

  const participants: Participant[] = participantNames.map((pName) => ({
    id: nanoid(8),
    name: pName,
    avatar: pName.trim().charAt(0).toUpperCase(),
    wallet: { address: "", seed: "" },
  }));

  const trip: Trip = {
    id: nanoid(10),
    name,
    participants,
    expenses: [],
    status: "active",
    createdAt: new Date().toISOString(),
  };

  store.setTrip(trip);
  return NextResponse.json(trip, { status: 201 });
}
