import { useQuery } from "@tanstack/react-query";

import {
  getVenueEnquiries,
  getVenueEnquiry,
  getVenueReplyTemplates,
} from "@/features/venues/api/venueEnquiriesApi";
import type { VenueEnquiry } from "@/features/venues/lib/venueEnquiries";

export type VenueReplyTemplate = {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  kind: "Decline" | "More info";
  body: string;
  created_at: string;
  updated_at: string;
};

export const venueEnquiriesKey = (workspaceId?: string | null) =>
  ["venue-enquiries", workspaceId] as const;

export function useVenueEnquiries(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: venueEnquiriesKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await getVenueEnquiries(workspaceId);
      if (error) throw error;
      return (data as VenueEnquiry[]) || [];
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return {
    enquiries: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}

export const venueEnquiryKey = (enquiryId?: string | null) =>
  ["venue-enquiry", enquiryId] as const;

export function useVenueEnquiry(enquiryId?: string | null) {
  const query = useQuery({
    queryKey: venueEnquiryKey(enquiryId),
    queryFn: async () => {
      const { data, error } = await getVenueEnquiry(enquiryId as string);
      if (error) throw error;
      return (data as VenueEnquiry | null) ?? null;
    },
    enabled: Boolean(enquiryId),
    retry: false,
  });

  return {
    enquiry: query.data ?? null,
    loading: query.isPending && query.fetchStatus !== "idle",
    error: (query.error as { message: string } | null) ?? null,
  };
}

export const venueReplyTemplatesKey = (workspaceId?: string | null) =>
  ["venue-reply-templates", workspaceId] as const;

export function useVenueReplyTemplates(workspaceId?: string | null) {
  const query = useQuery({
    queryKey: venueReplyTemplatesKey(workspaceId),
    queryFn: async () => {
      const { data, error } = await getVenueReplyTemplates(workspaceId);
      if (error) throw error;
      return (data as VenueReplyTemplate[]) || [];
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });

  return {
    templates: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
  };
}
