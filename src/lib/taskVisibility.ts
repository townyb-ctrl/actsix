export const personalNextActionFilter = (personId?: string | null) =>
  personId
    ? `project_id.is.null,assigned_person_id.eq.${personId}`
    : "project_id.is.null";
