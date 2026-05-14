import Image from "next/image";
import { Users } from "lucide-react";
import type { Character } from "@prisma/client";

interface CharacterGridProps {
  characters: Character[];
}

export function CharacterGrid({ characters }: CharacterGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {characters.map((character) => (
        <div
          key={character.id}
          className="group flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-card transition-all hover:border-accent-purple/30 hover:shadow-lg hover:shadow-accent-purple/5"
        >
          <div className="relative aspect-[3/4] w-full bg-bg">
            {character.refImageUrl ? (
              <Image
                src={character.refImageUrl}
                alt={character.name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-fg-subtle">
                <Users className="h-8 w-8 opacity-20" />
                <span className="text-[10px] uppercase tracking-widest">No Image</span>
              </div>
            )}
          </div>
          <div className="p-3">
            <div className="truncate font-semibold text-sm">{character.name}</div>
            {character.description && (
              <div className="mt-0.5 line-clamp-2 text-[11px] text-fg-muted leading-relaxed">
                {character.description}
              </div>
            )}
            {character.volcengineStatus && (
              <div
                className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  character.volcengineStatus === "Active"
                    ? "bg-accent-green/10 text-accent-green"
                    : character.volcengineStatus === "Failed"
                    ? "bg-red-500/10 text-red-400"
                    : "bg-fg-subtle/10 text-fg-subtle"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    character.volcengineStatus === "Active"
                      ? "bg-accent-green"
                      : character.volcengineStatus === "Failed"
                      ? "bg-red-400"
                      : "bg-fg-subtle"
                  }`}
                />
                {character.volcengineStatus}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
