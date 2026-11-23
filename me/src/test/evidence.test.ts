import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { records, recordIds, recordSearch } from "@/lib/evidence";

const evidenceCsv = readFileSync("../data/decision_evidence.csv", "utf8");
const decisionsCsv = readFileSync("../data/decisions.csv", "utf8");

describe("public evidence archive", () => {
  it.each(recordIds)("keeps %s aligned with the decision and evidence exports", (id) => {
    const record = records[id];
    const references = evidenceCsv
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((row) => row.split(","));
    expect(references.filter(([owner]) => owner === id).map(([, , ref]) => ref)).toEqual(
      record.evidence,
    );
    const decision = decisionsCsv.split(/\r?\n/).find((row) => row.startsWith(id + ","));
    expect(decision).toContain(
      [
        record.date,
        record.owner,
        "payments-migration",
        record.status === "Current" ? "active" : "superseded",
        record.replaces ?? "",
      ].join(","),
    );
    expect(recordSearch({ record: id })).toEqual({ record: id });
  });
  it("opens the archive index for missing or unknown record links", () => {
    for (const record of [undefined, "missing", "toString", null, ["D-19"]]) {
      expect(recordSearch({ record })).toEqual({});
    }
  });
});
