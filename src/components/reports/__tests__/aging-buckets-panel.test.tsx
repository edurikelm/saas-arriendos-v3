import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgingBucketsPanel } from "../aging-buckets-panel";
import type { AgingBucket } from "@/lib/reports/collection";

function emptyBuckets(): AgingBucket[] {
  return [
    { key: "DUE_SOON", label: "Vence en 7 días", amount: 0, count: 0 },
    { key: "OVERDUE_1_30", label: "Vencido 1–30 días", amount: 0, count: 0 },
    { key: "OVERDUE_31_60", label: "Vencido 31–60 días", amount: 0, count: 0 },
    { key: "OVERDUE_60_PLUS", label: "Vencido más de 60", amount: 0, count: 0 },
  ];
}

describe("AgingBucketsPanel", () => {
  it("shows a success empty state when all buckets are 0", () => {
    render(<AgingBucketsPanel buckets={emptyBuckets()} />);
    expect(screen.getByText(/sin cobros vencidos ni por vencer/i)).toBeTruthy();
  });

  it("renders all 4 buckets with amount and count when there is debt", () => {
    const buckets = emptyBuckets();
    buckets[1] = { key: "OVERDUE_1_30", label: "Vencido 1–30 días", amount: 120_000, count: 2 };
    render(<AgingBucketsPanel buckets={buckets} />);
    expect(screen.getByText("Vencido 1–30 días")).toBeTruthy();
    expect(screen.getByText(/2 cobros · \$120\.000/)).toBeTruthy();
    // Still renders the other 3 labels even at 0
    expect(screen.getByText("Vence en 7 días")).toBeTruthy();
    expect(screen.getByText("Vencido 31–60 días")).toBeTruthy();
    expect(screen.getByText("Vencido más de 60")).toBeTruthy();
  });

  it("uses singular 'cobro' for count === 1", () => {
    const buckets = emptyBuckets();
    buckets[0] = { key: "DUE_SOON", label: "Vence en 7 días", amount: 50_000, count: 1 };
    render(<AgingBucketsPanel buckets={buckets} />);
    expect(screen.getByText(/1 cobro · \$50\.000/)).toBeTruthy();
  });
});
