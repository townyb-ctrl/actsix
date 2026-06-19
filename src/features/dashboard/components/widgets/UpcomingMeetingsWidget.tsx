import { CalendarDays } from "lucide-react";
import type { DashboardWidgetRenderProps } from "@/features/dashboard/types/dashboardTypes";
import { addDays, toDateKey } from "@/features/dashboard/utils/dashboardLayoutUtils";
import { WidgetEmptyState, WidgetLinkRow, WidgetMetaDate } from "./widgetPrimitives";

export function UpcomingMeetingsWidget({ widget, data }: DashboardWidgetRenderProps) {
  const limit = widget.settings?.itemLimit || 5;
  const endKey = toDateKey(addDays(new Date(`${data.todayKey}T00:00:00`), 6));
  const meetings = data.meetings
    .filter((meeting) => meeting.meeting_date && meeting.meeting_date >= data.todayKey && meeting.meeting_date <= endKey)
    .slice(0, limit);

  if (meetings.length === 0) {
    return <WidgetEmptyState>No meetings in the next 6 days.</WidgetEmptyState>;
  }

  return (
    <div className="space-y-3">
      {meetings.map((meeting) => (
        <WidgetLinkRow
          key={meeting.id}
          to={`/meetings/${meeting.id}`}
          icon={CalendarDays}
          iconClassName="bg-brand-bronze/10 text-brand-bronze"
          title={meeting.title}
          meta={
            <>
              <WidgetMetaDate date={meeting.meeting_date} time={meeting.meeting_time} />
              {meeting.location && <span className="truncate">{meeting.location}</span>}
            </>
          }
        />
      ))}
    </div>
  );
}
