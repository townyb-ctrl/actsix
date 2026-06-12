import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { filterPeopleOptions, type PeoplePickerPerson } from "@/components/people/peoplePickerUtils";

type PersonOption = PeoplePickerPerson;

type PeopleMultiSearchSelectProps = {
  people: PersonOption[];
  selectedPersonIds: string[];
  onChange: (personIds: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  showAllOnFocus?: boolean;
};

export function PeopleMultiSearchSelect({
  people,
  selectedPersonIds,
  onChange,
  placeholder = "Search people...",
  emptyText = "No matching People profiles found.",
  disabled = false,
  showAllOnFocus = false,
}: PeopleMultiSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dropdownId = useRef(`people-multi-${Math.random().toString(36).slice(2)}`);
  const inputId = useId();
  const listboxId = useId();

  const selectedPeople = useMemo(
    () => people.filter((person) => selectedPersonIds.includes(person.id)),
    [people, selectedPersonIds]
  );

  const filteredPeople = useMemo(() => {
    return filterPeopleOptions(people, query, {
      excludeIds: selectedPersonIds,
      showAllOnFocus,
    });
  }, [people, query, selectedPersonIds, showAllOnFocus]);

  const announceOpen = () => {
    document.dispatchEvent(
      new CustomEvent("actsix-dropdown-open", { detail: dropdownId.current })
    );
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current) return;

      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleOtherDropdownOpen = (event: Event) => {
      const customEvent = event as CustomEvent<string>;

      if (customEvent.detail !== dropdownId.current) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("actsix-dropdown-open", handleOtherDropdownOpen as EventListener);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("actsix-dropdown-open", handleOtherDropdownOpen as EventListener);
    };
  }, []);

  const addPerson = (personId: string) => {
    if (selectedPersonIds.includes(personId)) return;

    onChange([...selectedPersonIds, personId]);
    setQuery("");
    setOpen(false);
  };

  const removePerson = (personId: string) => {
    onChange(selectedPersonIds.filter((id) => id !== personId));
  };

  return (
    <div ref={wrapperRef} className={`relative space-y-2 ${open ? "z-30" : "z-10"}`}>
      <div className="min-h-10 rounded-[var(--radius-control)] border border-border/70 bg-background px-3 py-1.5 transition focus-within:border-brand-teal/50 focus-within:ring-2 focus-within:ring-brand-teal/20">
        <div className="flex flex-wrap items-center gap-2">
          {selectedPeople.map((person) => (
            <span
              key={person.id}
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-brand-teal/20 bg-brand-teal/10 py-0.5 pl-2 pr-1 text-sm"
            >
              <PersonAvatar
                name={person.display_name}
                avatarUrl={person.avatar_url}
                size="sm"
              />

              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {person.display_name}
                </span>
                {person.email && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {person.email}
                  </span>
                )}
              </span>

              <button
                type="button"
                className="ml-1 rounded-full p-1 text-muted-foreground transition hover:bg-background hover:text-foreground"
                onClick={() => removePerson(person.id)}
                aria-label={`Remove ${person.display_name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}

          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              id={inputId}
              value={query}
              disabled={disabled}
              role="combobox"
              aria-label={placeholder}
              aria-expanded={open}
              aria-controls={listboxId}
              aria-haspopup="listbox"
              aria-autocomplete="list"
              onFocus={() => {
                announceOpen();
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                }
              }}
              onChange={(event) => {
                announceOpen();
                setQuery(event.target.value);
                setOpen(true);
              }}
              placeholder={placeholder}
              type="search"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              name="actsix-people-search"
              className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </div>

      {open && (showAllOnFocus || query.trim().length >= 2) && (
        <div id={listboxId} role="listbox" className="actsix-overlay-surface absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            {filteredPeople.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              filteredPeople.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  aria-label={`Add ${person.display_name}`}
                  className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-brand-teal/5"
                  onClick={() => addPerson(person.id)}
                >
                  <PersonAvatar
                    name={person.display_name}
                    avatarUrl={person.avatar_url}
                    size="md"
                  />

                  <span className="min-w-0">
                    <span className="block truncate font-extrabold tracking-tight">
                      {person.display_name}
                    </span>
                    {person.email && (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {person.email}
                      </span>
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {open && !showAllOnFocus && query.trim().length > 0 && query.trim().length < 2 && (
        <div className="actsix-overlay-surface absolute left-0 right-0 top-full z-40 mt-2 px-4 py-3 text-sm text-muted-foreground">
          Type at least 2 letters to search.
        </div>
      )}
    </div>
  );
}
