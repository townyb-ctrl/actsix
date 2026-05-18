import { useMemo, useState } from "react";
import { Search, Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatPhoneForDisplay } from "@/lib/phone";

export type PeopleSearchPerson = {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  email?: string | null;
  phone_number?: string | null;
};

type PeopleSearchSelectProps = {
  people: PeopleSearchPerson[];
  selectedPersonId: string;
  onSelect: (personId: string) => void;
  placeholder?: string;
  emptyText?: string;
};

export function PeopleSearchSelect({
  people,
  selectedPersonId,
  onSelect,
  placeholder = "Search people...",
  emptyText = "No people found.",
}: PeopleSearchSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const selectedPerson = people.find((person) => person.id === selectedPersonId) || null;

  const results = useMemo(() => {
    const cleanSearch = searchTerm.trim().toLowerCase();

    if (cleanSearch.length < 2) return [];

    return people
      .filter((person) => {
        return [
          person.display_name,
          person.email,
          person.phone_number,
          formatPhoneForDisplay(person.phone_number),
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(cleanSearch));
      })
      .slice(0, 8);
  }, [people, searchTerm]);

  return (
    <div className="space-y-2">
      {selectedPerson ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand-teal/30 bg-brand-teal/10 px-3 py-2">
          <div className="flex min-w-0 items-center gap-3">
            {selectedPerson.avatar_url ? (
              <img
                src={selectedPerson.avatar_url}
                alt={selectedPerson.display_name}
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-teal/15 text-brand-teal">
                <Users className="h-4 w-4" />
              </span>
            )}

            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold tracking-tight">
                {selectedPerson.display_name}
              </p>
              {(selectedPerson.email || selectedPerson.phone_number) && (
                <p className="truncate text-xs text-muted-foreground">
                  {selectedPerson.email || formatPhoneForDisplay(selectedPerson.phone_number)}
                </p>
              )}
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-destructive"
            onClick={() => {
              onSelect("");
              setSearchTerm("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={placeholder}
              className="h-11 rounded-xl border-border/70 bg-background pl-9"
            />
          </div>

          {searchTerm.trim().length > 0 && searchTerm.trim().length < 2 && (
            <p className="text-xs text-muted-foreground">
              Type at least 2 characters to search.
            </p>
          )}

          {searchTerm.trim().length >= 2 && (
            <div className="max-h-64 overflow-auto rounded-2xl border border-border/70 bg-card shadow-sm">
              {results.length === 0 && (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  {emptyText}
                </div>
              )}

              {results.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-brand-teal/5"
                  onClick={() => {
                    onSelect(person.id);
                    setSearchTerm("");
                  }}
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
                        {person.email || formatPhoneForDisplay(person.phone_number)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
