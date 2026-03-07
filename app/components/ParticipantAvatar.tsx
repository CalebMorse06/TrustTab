"use client";

import { Participant } from "@/lib/types";

export function ParticipantAvatar({
  participant,
  size = "md",
}: {
  participant: Participant;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-lg",
    lg: "w-14 h-14 text-2xl",
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-secondary flex items-center justify-center border border-border`}
      title={participant.name}
    >
      {participant.avatar}
    </div>
  );
}
