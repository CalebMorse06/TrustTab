import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST(request: NextRequest) {
  try {
    const { tripId, participantId, approved } = await request.json();

    const trip = store.getTrip(tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const participant = trip.participants.find((p) => p.id === participantId);
    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    if (!trip.approvals) {
      trip.approvals = {};
    }

    trip.approvals[participantId] = {
      approved: approved !== false,
      timestamp: new Date().toISOString(),
    };

    store.setTrip(trip);

    const allApproved = trip.participants.every(
      (p) => trip.approvals?.[p.id]?.approved
    );

    return NextResponse.json({
      tripId,
      participantId,
      approved: trip.approvals[participantId].approved,
      allApproved,
      approvals: trip.approvals,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Approval failed: " + (error instanceof Error ? error.message : "unknown") },
      { status: 500 }
    );
  }
}
