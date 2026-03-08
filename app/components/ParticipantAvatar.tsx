"use client";

import { Participant } from "@/lib/types";

const BORDER_COLORS = [
  "#b45534",
  "#6b7c5e",
  "#c2b59b",
  "#c4893b",
  "#8a7e72",
];

export function ParticipantAvatar({
  participant,
  size = "md",
  index = 0,
}: {
  participant: Participant;
  size?: "sm" | "md" | "lg";
  index?: number;
}) {
  const sizeClasses = {
    sm: "w-7 h-7 text-[11px]",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-lg",
  };

  const borderColor = BORDER_COLORS[index % BORDER_COLORS.length];

  return (
    <div
      className={`${sizeClasses[size]} bg-secondary flex items-center justify-center font-mono font-bold tracking-tight text-foreground`}
      style={{ borderLeft: `3px solid ${borderColor}` }}
      title={participant.name}
    >
      {participant.name.charAt(0).toUpperCase()}
    </div>
  );
}
