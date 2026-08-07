import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, UsersRound } from "lucide-react";
import { Input } from "@/components/ui/input";

export type MeetingSourceOption = {
  value: string;
  label: string;
  description?: string | null;
};

export function MeetingSourceCombobox({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: MeetingSourceOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  /** Accessible name for the trigger. The visible caption above it is not a
   *  `<label>` — this is a button, not a native form control. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const instanceId = useId();
  const dropdownId = useRef(`meeting-source-${instanceId}`);

  const selectedOption = options.find((option) => option.value === value);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return options;

    return options.filter((option) =>
      [option.label, option.description]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(normalizedQuery))
    );
  }, [options, query]);

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

  return (
    <div ref={wrapperRef} className={`relative ${open ? "z-[var(--z-dropdown)]" : "z-0"}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="flex min-h-10 w-full items-center justify-between gap-2.5 rounded-lg border border-border/70 bg-background px-3 py-2.5 text-left text-sm transition hover:border-brand-teal/40 hover:bg-brand-teal/5 focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
        onClick={() => {
          if (!open) {
            announceOpen();
            setOpen(true);
            return;
          }

          setOpen(false);
        }}
      >
        <span className={selectedOption ? "truncate font-semibold text-foreground" : "truncate text-muted-foreground"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="actsix-panel absolute left-0 right-0 top-full z-[var(--z-dropdown-panel)] mt-2 overflow-hidden rounded-xl">
          <div className="border-b border-border/70 bg-background/95 p-2.5">
            <div className="actsix-search-field">
              <Search className="actsix-search-icon" />
              <Input
                value={query}
                onFocus={announceOpen}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="actsix-search-input pr-3 focus-visible:ring-brand-teal/40"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto bg-background">
            {filteredOptions.length === 0 && (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                {emptyText}
              </div>
            )}

            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-brand-teal/5"
                onClick={() => {
                  onChange(option.value);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal">
                  <UsersRound className="h-4 w-4" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold tracking-tight text-foreground">
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </span>

                <Check
                  className={`h-4 w-4 shrink-0 text-brand-teal ${
                    value === option.value ? "opacity-100" : "opacity-0"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
