import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export type PeopleMultiSearchPerson = {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  email?: string | null;
  phone_number?: string | null;
};

type PeopleMultiSearchSelectProps = {
  people: PeopleMultiSearchPerson[];
  selectedPersonIds: string[];
  onChange: (personIds: string[]) => void;
  placeholder?: string;
  emptyText?: string;
};

export function PeopleMultiSearchSelect({
  people,
  selectedPersonIds,
  onChange,
  placeholder = "Search people...",
  emptyText = "No people found.",
}: PeopleMultiSearchSelectProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedPeople = useMemo(() => {
    return selectedPersonIds
      .map((personId) => people.find((person) => person.id === personId))
      .filter(Boolean) as PeopleMultiSearchPerson[];
  }, [people, selectedPersonIds]);

  const results = useMemo(() => {
    const cleanSearch = searchTerm.trim().toLowerCase();

    if (cleanSearch.length < 2) return [];

    return people
      .filter((person) => {
        return [person.display_name, person.email, person.phone_number]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(cleanSearch));
      })
      .slice(0, 10);
  }, [people, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const togglePerson = (personId: string) => {
    if (selectedPersonIds.includes(personId)) {
      onChange(selectedPersonIds.filter((id) => id !== personId));
      return;
    }

    onChange([...selectedPersonIds, personId]);
  };

  const removePerson = (personId: string) => {
    onChange(selectedPersonIds.filter((id) => id !== personId));
  };

  const buttonLabel = (() => {
    if (selectedPeople.length === 0) return "Select people...";

    if (selectedPeople.length === 1) {
      return selectedPeople[0].display_name;
    }

    const [first, second, ...rest] = selectedPeople;

    if (rest.length === 0) {
      return `${first.display_name}, ${second.display_name}`;
    }

    return `${first.display_name}, ${second.display_name} +${rest.length}`;
  })();

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        className="grid h-12 w-full grid-cols-1 rounded-2xl border border-border/70 bg-background px-3 text-left outline-none transition hover:bg-muted/30 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-3 pr-7">
          {selectedPeople.length > 0 ? (
            <span className="flex shrink-0 -space-x-2">
              {selectedPeople.slice(0, 3).map((person) =>
                person.avatar_url ? (
                  <img
                    key={person.id}
                    src={person.avatar_url}
                    alt={person.display_name}
                    className="h-7 w-7 rounded-full border-2 border-background object-cover"
                  />
                ) : (
                  <span
                    key={person.id}
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-brand-teal/10 text-brand-teal"
                  >
                    <Users className="h-3.5 w-3.5" />
                  </span>
                )
              )}

              {selectedPeople.length > 3 && (
                <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-bold text-muted-foreground">
                  +{selectedPeople.length - 3}
                </span>
              )}
            </span>
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal">
              <Users className="h-3.5 w-3.5" />
            </span>
          )}

          <span
            className={`block truncate text-sm font-bold ${
              selectedPeople.length > 0 ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {buttonLabel}
          </span>
        </span>

        <ChevronsUpDown className="col-start-1 row-start-1 h-4 w-4 self-center justify-self-end text-muted-foreground" />
      </button>

      {selectedPeople.length > 0 && (
        <div className="mt-2 flex max-h-20 flex-wrap gap-2 overflow-auto pr-1">
          {selectedPeople.map((person) => (
            <span
              key={person.id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-brand-teal/30 bg-brand-teal/10 px-2.5 py-1 text-xs font-bold text-brand-teal"
            >
              <span className="max-w-[180px] truncate">{person.display_name}</span>
              <button
                type="button"
                className="text-brand-teal/70 transition hover:text-destructive"
                onClick={() => removePerson(person.id)}
                aria-label={`Remove ${person.display_name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-14 z-50 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl">
          <div className="border-b border-border/70 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={placeholder}
                className="h-10 rounded-xl border-border/70 bg-background pl-9"
              />
            </div>
          </div>

          <div className="h-64 overflow-auto">
            {searchTerm.trim().length === 0 && (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                Start typing to search your People directory.
              </div>
            )}

            {searchTerm.trim().length > 0 && searchTerm.trim().length < 2 && (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search.
              </div>
            )}

            {searchTerm.trim().length >= 2 && results.length === 0 && (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>
            )}

            {searchTerm.trim().length >= 2 &&
              results.map((person) => {
                const selected = selectedPersonIds.includes(person.id);

                return (
                  <button
                    key={person.id}
                    type="button"
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                      selected ? "bg-brand-teal/10" : "hover:bg-brand-teal/5"
                    }`}
                    onClick={() => togglePerson(person.id)}
                  >
                    {person.avatar_url ? (
                      <img
                        src={person.avatar_url}
                        alt={person.display_name}
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal">
                        <Users className="h-4 w-4" />
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold tracking-tight">
                        {person.display_name}
                      </p>
                      {(person.email || person.phone_number) && (
                        <p className="truncate text-xs text-muted-foreground">
                          {person.email || person.phone_number}
                        </p>
                      )}
                    </div>

                    {selected && (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-teal text-white">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </button>
                );
              })}
          </div>

          {selectedPeople.length > 0 && (
            <div className="flex items-center justify-between border-t border-border/70 bg-background/70 px-4 py-3 text-xs text-muted-foreground">
              <span>
                {selectedPeople.length} selected
              </span>

              <button
                type="button"
                className="font-bold text-brand-teal hover:text-brand-teal-dark"
                onClick={() => {
                  setOpen(false);
                  setSearchTerm("");
                }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
