"use client";

// Sélecteur d'équipe filtrable (combobox accessible).
//
// Utilisé pour le Prix du Fair-Play (récompense d'équipe).
// Suit le même motif d'accessibilité que PlayerSelector :
// role="combobox" + aria-expanded + aria-controls ; liste role="listbox" ;
// options role="option" + aria-selected. Navigation clavier : flèches, Entrée,
// Échap.

import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface TeamOption {
  id: string;
  name: string;
  code: string;
  group: string;
  flagUrl: string;
}

interface TeamSelectorProps {
  /** Code de l'équipe actuellement sélectionnée, le cas échéant. */
  value: string | null;
  /** Libellé de l'équipe sélectionnée, affiché lorsque la liste est fermée. */
  valueLabel?: string | null;
  /** Appelé lorsqu'une équipe est choisie dans la liste. */
  onSelect: (team: TeamOption) => void;
  /** Désactive le sélecteur (récompenses verrouillées). */
  disabled?: boolean;
  /** Identifiant utilisé pour lier le label externe au champ. */
  inputId: string;
  /** Décrit le champ pour les lecteurs d'écran. */
  describedById?: string;
}

export function TeamSelector({
  value,
  valueLabel,
  onSelect,
  disabled = false,
  inputId,
  describedById,
}: TeamSelectorProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<TeamOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  // Recherche débattue : interroge l'API à chaque changement de requête.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        const response = await fetch(`/api/teams?${params.toString()}`);
        if (!response.ok) {
          if (!cancelled) setOptions([]);
          return;
        }
        const data = (await response.json()) as { teams: TeamOption[] };
        if (!cancelled) {
          setOptions(data.teams ?? []);
          setActiveIndex(data.teams?.length ? 0 : -1);
        }
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, open]);

  // Ferme la liste lorsqu'on clique en dehors du composant.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(team: TeamOption) {
    onSelect(team);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        setActiveIndex((index) =>
          options.length === 0 ? -1 : (index + 1) % options.length
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        setActiveIndex((index) =>
          options.length === 0
            ? -1
            : (index - 1 + options.length) % options.length
        );
        break;
      case "Enter":
        if (open && activeIndex >= 0 && options[activeIndex]) {
          event.preventDefault();
          handleSelect(options[activeIndex]);
        }
        break;
      case "Escape":
        setOpen(false);
        break;
      default:
        break;
    }
  }

  const displayValue = open ? query : valueLabel ?? "";

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-describedby={describedById}
        autoComplete="off"
        placeholder={
          value ? "Modifier l'équipe sélectionnée…" : "Rechercher une équipe…"
        }
        value={displayValue}
        disabled={disabled}
        onFocus={() => !disabled && setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />

      {open && !disabled && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md"
        >
          {loading && (
            <li className="px-3 py-2 text-muted-foreground" aria-disabled>
              Recherche en cours…
            </li>
          )}
          {!loading && options.length === 0 && (
            <li className="px-3 py-2 text-muted-foreground" aria-disabled>
              Aucune équipe trouvée.
            </li>
          )}
          {!loading &&
            options.map((team, index) => {
              const isActive = index === activeIndex;
              const isSelected = team.code === value;
              return (
                <li
                  key={team.code}
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "flex min-h-[44px] cursor-pointer items-center justify-between gap-2 px-3 py-2",
                    isActive && "bg-accent text-accent-foreground",
                    isSelected && "font-medium"
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(team);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <img
                      src={`/flags/${team.code.toLowerCase()}.svg`}
                      alt={team.code}
                      width={20}
                      height={14}
                      className="shrink-0 rounded-sm object-cover"
                    />
                    {team.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Groupe {team.group}
                  </span>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
