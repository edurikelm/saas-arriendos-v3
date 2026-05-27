import { describe, expect, it } from "vitest";
import { mapPaymentResultState } from "../result-state";

describe("mapPaymentResultState", () => {
  it("returns not_found when paymentId hint is missing", () => {
    const state = mapPaymentResultState({
      hasPaymentIdHint: false,
      internalStatus: null,
      redirectStatus: "success",
      collectionStatus: "approved",
    });

    expect(state).toBe("not_found");
  });

  it("returns confirming when redirect says success but DB is still pending", () => {
    const state = mapPaymentResultState({
      hasPaymentIdHint: true,
      internalStatus: "PENDING",
      redirectStatus: "success",
      collectionStatus: "approved",
    });

    expect(state).toBe("confirming");
  });

  it("returns completed only when internal status is completed", () => {
    const state = mapPaymentResultState({
      hasPaymentIdHint: true,
      internalStatus: "COMPLETED",
      redirectStatus: "failure",
      collectionStatus: "rejected",
    });

    expect(state).toBe("completed");
  });

  it("returns failed when internal status is failed", () => {
    const state = mapPaymentResultState({
      hasPaymentIdHint: true,
      internalStatus: "FAILED",
      redirectStatus: "pending",
      collectionStatus: "in_process",
    });

    expect(state).toBe("failed");
  });
});
