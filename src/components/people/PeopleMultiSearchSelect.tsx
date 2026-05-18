import { useMemo, useState } from "react";
import { Search, Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
      .filter((person) => !selectedPersonIds.includes(person.id))
      .filter((person) => {
        return [person.display_name, person.email, person.phone_number]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(cleanSearch));
      })
      .slice(0, 8);
  }, [people, searchTerm, selectedPersonIds]);

  const addPerson = (personId: string) => {
    if (selectedPersonIds.includes(personId)) return;
    onChange([...selectedPersonIds, personId]);
    setSearchTerm("");
  };

  const removePerson = (personId: string) => {
    onChange(selectedPersonIds.filter((id) => id !== personId));
  };

  return (
    <div className="space-y-3">
      <div className="min-h-[92px] rounded-2xl border border-border/70 bg-background/70 p-3">
        {selectedPeople.length === 0 ? (
          <div className="flex h-16 items-center justify-center text-sm text-muted-foreground">
            No people selected yet.
          </div>
        ) : (
          <div className="flex max-h-24 flex-wrap gap-2 overflow-auto pr-1">
            {selectedPeople.map((person) => (
              <div
                key={person.id}
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-brand-teal/30 bg-brand-teal/10 px-2.5 py-1.5 text-sm"
              >
                {person.avatar_url ? (
                  <img
                    src={person.avatar_url}
                    alt={person.display_name}
                    className="h-7 w-7 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-teal/15 text-brand-teal">
                    <Users className="h-3.5 w-3.5" />
                  </span>
                )}

                <span className="max-w-[180px] truncate font-bold">
                  {person.display_name}
                </span>

                <button
                  type="button"
                  className="text-muted-foreground transition hover:text-destructive"
                  onClick={() => removePerson(person.id)}
                  aria-label={`Remove ${person.display_name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={placeholder}
          className="h-11 rounded-xl border-border/70 bg-background pl-9"
        />
      </div>

      <div className="h-52 overflow-hidden rounded-2xl border border-border/70 bg-card">
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

        {searchTerm.trim().length >= 2 && results.length > 0 && (
          <div className="h-full divide-y divide-border overflow-auto">
            {results.map((person) => (
              <button
                key={person.id}
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-brand-teal/5"
                onClick={() => addPerson(person.id)}
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

                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold tracking-tight">
                    {person.display_name}
                  </p>
                  {(person.email || person.phone_number) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {person.email || person.phone_number}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
