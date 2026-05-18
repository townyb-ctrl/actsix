import { useMemo, useState } from "react";
import { Check, Search, Users, X } from "lucide-react";
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

  const showDropdown = searchTerm.trim().length > 0;

  return (
    <div className="relative space-y-3">
      <div className="relative z-[70]">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={placeholder}
          className="h-12 rounded-2xl border-border/70 bg-background pl-11 text-base"
        />

        {showDropdown && (
          <div className="absolute left-0 right-0 top-14 z-[90] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl">
            {searchTerm.trim().length < 2 && (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                Type at least 2 characters to search.
              </div>
            )}

            {searchTerm.trim().length >= 2 && results.length === 0 && (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                {emptyText}
              </div>
            )}

            {searchTerm.trim().length >= 2 && results.length > 0 && (
              <div className="max-h-72 divide-y divide-border overflow-auto">
                {results.map((person) => {
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
                          className="h-8 w-8 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal">
                          <Users className="h-3.5 w-3.5" />
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold tracking-tight">
                          {person.display_name}
                        </p>
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
            )}
          </div>
        )}
      </div>

      {selectedPeople.length > 0 && (
        <div className="relative z-[20] flex flex-wrap gap-2">
          {selectedPeople.map((person) => (
            <span
              key={person.id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-brand-teal/30 bg-brand-teal/10 px-2.5 py-1 text-xs font-bold text-brand-teal"
            >
              <span className="max-w-[180px] truncate">
                {person.display_name}
              </span>

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
    </div>
  );
}
