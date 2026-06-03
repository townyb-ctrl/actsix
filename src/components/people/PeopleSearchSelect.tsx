import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatPhoneForDisplay } from "@/lib/phone";
import { PersonAvatar } from "@/components/people/PersonAvatar";

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
  onCreatePerson?: (displayName: string) => Promise<void> | void;
  zIndexClass?: string;
  dropdownZIndexClass?: string;
  showAllOnFocus?: boolean;
};

export function PeopleSearchSelect({
  people,
  selectedPersonId,
  onSelect,
  placeholder = "Search people...",
  emptyText = "No people found.",
  onCreatePerson,
  zIndexClass = "z-20",
  dropdownZIndexClass = "z-30",
  showAllOnFocus = false,
}: PeopleSearchSelectProps) {
  const inputId = useId();
  const peopleSearchSelectRef = useRef<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);

  const selectedPerson = people.find((person) => person.id === selectedPersonId) || null;

  const cleanSearch = searchTerm.trim();

  const results = useMemo(() => {
    const query = cleanSearch.toLowerCase();

    if (query.length < 2) return showAllOnFocus ? people.slice(0, 8) : [];

    return people
      .filter((person) => {
        return [
          person.display_name,
          person.email,
          person.phone_number,
          formatPhoneForDisplay(person.phone_number),
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      })
      .slice(0, 8);
  }, [people, cleanSearch]);

  const showDropdown = open && (showAllOnFocus || cleanSearch.length > 0) && !selectedPerson;
  const canCreate = Boolean(onCreatePerson && cleanSearch.length >= 2);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!peopleSearchSelectRef.current) return;

      if (!peopleSearchSelectRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  const createPerson = async () => {
    if (!onCreatePerson || !cleanSearch) return;

    setCreating(true);

    try {
      await onCreatePerson(cleanSearch);
      setSearchTerm("");
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={peopleSearchSelectRef} className={`relative ${zIndexClass} space-y-2`}>
      {selectedPerson ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand-teal/30 bg-brand-teal/10 px-3 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <PersonAvatar
              name={selectedPerson.display_name}
              avatarUrl={selectedPerson.avatar_url}
              size="md"
            />

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
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={inputId}
            name={`actsix-people-search-${inputId}`}
            type="search"
            value={searchTerm}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setOpen(true);
            }}
            placeholder={placeholder}
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="h-12 rounded-2xl border-border/70 bg-background pl-11 text-base"
          />

          {showDropdown && (
            <div className={`absolute left-0 right-0 top-14 ${dropdownZIndexClass} overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl`}>
              {!showAllOnFocus && cleanSearch.length < 2 && (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  Type at least 2 characters to search.
                </div>
              )}

              {(showAllOnFocus || cleanSearch.length >= 2) && results.length === 0 && (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  {emptyText}
                </div>
              )}

              {(showAllOnFocus || cleanSearch.length >= 2) && results.length > 0 && (
                <div className="max-h-72 divide-y divide-border overflow-auto">
                  {results.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-brand-teal/5"
                      onClick={() => {
                        onSelect(person.id);
                        setSearchTerm("");
                        setOpen(false);
                      }}
                    >
                      <PersonAvatar
                        name={person.display_name}
                        avatarUrl={person.avatar_url}
                        size="md"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold tracking-tight">
                          {person.display_name}
                        </p>
                      </div>

                      {person.id === selectedPersonId && (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-teal text-white">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {canCreate && (
                <button
                  type="button"
                  className="flex w-full items-center gap-3 border-t border-border bg-brand-teal/5 px-4 py-3 text-left text-sm font-extrabold text-brand-teal transition hover:bg-brand-teal/10"
                  onClick={createPerson}
                  disabled={creating}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-teal/10">
                    <Plus className="h-4 w-4" />
                  </span>
                  {creating ? "Creating profile..." : `Add “${cleanSearch}” as new People profile`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
