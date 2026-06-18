export const personalNextActionFilter = (personId?: string | null) =>
  personId
    ? `project_id.is.null,assigned_person_id.eq.${personId},section_id.not.is.null`
    : "project_id.is.null,section_id.not.is.null";
