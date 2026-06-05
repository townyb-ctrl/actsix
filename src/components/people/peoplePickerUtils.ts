export type PeoplePickerPerson = {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  email?: string | null;
  phone_number?: string | null;
};

export function filterPeopleOptions<T extends PeoplePickerPerson>(
  people: T[],
  query: string,
  options?: {
    excludeIds?: string[];
    showAllOnFocus?: boolean;
    minQueryLength?: number;
    limit?: number;
  },
) {
  const normalizedQuery = query.trim().toLowerCase();
  const excludeIds = new Set(options?.excludeIds || []);
  const showAllOnFocus = options?.showAllOnFocus ?? false;
  const minQueryLength = options?.minQueryLength ?? 2;
  const limit = options?.limit;

  const filtered = people
    .filter((person) => !excludeIds.has(person.id))
    .filter((person) => {
      if (!normalizedQuery) return showAllOnFocus;
      if (normalizedQuery.length < minQueryLength) return false;

      return [person.display_name, person.email || "", person.phone_number || ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });

  return typeof limit === "number" ? filtered.slice(0, limit) : filtered;
}
