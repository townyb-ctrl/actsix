import { describe, expect, it } from "vitest";

import { personalNextActionFilter } from "./taskVisibility";

describe("personalNextActionFilter", () => {
  it("includes an assigned_person_id clause when a person id is given", () => {
    expect(personalNextActionFilter("person-1")).toBe(
      "project_id.is.null,assigned_person_id.eq.person-1,section_id.not.is.null"
    );
  });

  it("omits the assigned_person_id clause when no person id is given", () => {
    expect(personalNextActionFilter(undefined)).toBe("project_id.is.null,section_id.not.is.null");
    expect(personalNextActionFilter(null)).toBe("project_id.is.null,section_id.not.is.null");
  });
});
