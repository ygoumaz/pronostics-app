"use client";

// Sélecteur de joueur filtrable (combobox accessible).
//
// Référence : requirements.md - Exigence 18 (critères 18.2, 18.3, 18.5, 18.6,
// 18.7), 13.2 (responsive / accessibilité).
//
// Permet de rechercher un joueur par son nom parmi la liste pré-chargée via
// l'API GET /api/players?q=… puis d'en sélectionner exactement un. L'objectif
// est de garantir que seul un joueur EXISTANT de la liste officielle puisse
// être choisi (Exigence 18.3) : la sélection effective ne se fait qu'en
// cliquant un élément de la liste, jamais via la saisie libre.
//
// Accessibilité : implémente le motif ARIA combobox (role="combobox" +
// aria-expanded + aria-controls ; liste role="listbox" ; options
// role="option" + aria-selected). Navigation clavier : flèches haut/bas,
// Entrée pour valider, Échap pour fermer.

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PlayerOption {
  id: string;
  name: string;
  teamCode: string;
  position: string;
}

interface PlayerSelectorProps {
  /** Identifiant du joueur actuellement sélectionné (pré-rempli), le cas échéant. */
  value: string | null;
  /** Libellé du joueur sélectionné, affiché lorsque la liste est fermée. */
  valueLabel?: string | null;
  /** Appelé lorsqu'un joueur est choisi dans la liste. */
  onSelect: (player: PlayerOption) => void;
  /** Désactive le sélecteur (récompenses verrouillées — Exigences 18.6/18.7). */
  disabled?: boolean;
  /** Identifiant utilisé pour lier le label externe au champ. */
  inputId: string;
  /** Décrit le champ pour les lecteurs d'écran (lié via aria-describedby). */
  describedById?: string;
}

export function PlayerSelector({
  value,
  valueLabel,
  onSelect,
  disabled = false,
  inputId,
  describedById,
}: PlayerSelectorProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<PlayerOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  // Recherche débattue : interroge l'API à chaque changement de requête
  // lorsque la liste est ouverte. Un délai évite de spammer le serveur.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        params.set("limit", "50");
        const response = await fetch(`/api/players?${params.toString()}`);
        if (!response.ok) {
          if (!cancelled) setOptions([]);
          return;
        }
        const data = (await response.json()) as { players: PlayerOption[] };
        if (!cancelled) {
          setOptions(data.players ?? []);
          setActiveIndex(data.players?.length ? 0 : -1);
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

  function handleSelect(player: PlayerOption) {
    onSelect(player);
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

  // Texte affiché dans le champ : la requête en cours de frappe, sinon le
  // libellé du joueur sélectionné (pré-rempli — Exigence 18.12).
  const displayValue = open
    ? query
    : valueLabel ?? "";

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
          value ? "Modifier le joueur sélectionné…" : "Rechercher un joueur…"
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
            <li role="option" aria-disabled aria-selected={false} className="px-3 py-2 text-muted-foreground">
              Recherche en cours…
            </li>
          )}
          {!loading && options.length === 0 && (
            <li role="option" aria-disabled aria-selected={false} className="px-3 py-2 text-muted-foreground">
              Aucun joueur trouvé.
            </li>
          )}
          {!loading &&
            options.map((player, index) => {
              const isActive = index === activeIndex;
              const isSelected = player.id === value;
              return (
                <li
                  key={player.id}
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "flex min-h-[44px] cursor-pointer items-center justify-between gap-2 px-3 py-2",
                    isActive && "bg-accent text-accent-foreground",
                    isSelected && "font-medium"
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => {
                    // mousedown (avant blur) pour ne pas fermer avant le clic.
                    e.preventDefault();
                    handleSelect(player);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Image
                      src={`/flags/${player.teamCode.toLowerCase()}.svg`}
                      alt={player.teamCode}
                      width={20}
                      height={14}
                      className="shrink-0 rounded-sm object-cover"
                    />
                    {player.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {player.position}
                  </span>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
