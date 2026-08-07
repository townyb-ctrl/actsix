import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PeopleGroupOption = {
  id: string;
  name: string;
  members: {
    person_id: string;
    display_name: string;
  }[];
};

/**
 * People Groups available as a "People Group Source" for a recurring
 * meeting series, with their members preloaded. Shared by the create form
 * and the edit form so the group<->member fetch lives in one place.
 */
export function useRecurringPeopleGroupOptions() {
  const { user } = useAuth();
  const [peopleGroupOptions, setPeopleGroupOptions] = useState<PeopleGroupOption[]>([]);

  useEffect(() => {
    const loadPeopleGroupOptions = async () => {
      if (!user) return;

      const { data: groupsData, error: groupsError } = await (supabase as any)
        .from("people_groups")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (groupsError) {
        console.error(groupsError);
        return;
      }

      const { data: membersData, error: membersError } = await (supabase as any)
        .from("people_group_members")
        .select("group_id, person_id, people(id, display_name)")
        .eq("user_id", user.id);

      if (membersError) {
        console.error(membersError);
      }

      const membersByGroup = new Map<string, PeopleGroupOption["members"]>();

      (membersData || []).forEach((member: any) => {
        const person = Array.isArray(member.people) ? member.people[0] : member.people;

        if (!member.group_id || !member.person_id) return;

        const existing = membersByGroup.get(member.group_id) || [];

        existing.push({
          person_id: member.person_id,
          display_name: person?.display_name || "Unnamed person",
        });

        membersByGroup.set(member.group_id, existing);
      });

      setPeopleGroupOptions(
        (groupsData || []).map((group: any) => ({
          id: group.id,
          name: group.name,
          members: membersByGroup.get(group.id) || [],
        }))
      );
    };

    loadPeopleGroupOptions();
  }, [user]);

  return peopleGroupOptions;
}
