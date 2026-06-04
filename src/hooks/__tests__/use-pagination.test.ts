import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePagination } from "@/hooks/use-pagination";

describe("usePagination", () => {
  it("initializes with default values", () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, totalPages: 5 })
    );

    expect(result.current.page).toBe(1);
    expect(result.current.limit).toBe(10);
    expect(result.current.range).toEqual({ start: 1, end: 10 });
  });

  it("goToPage navigates within bounds", () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, totalPages: 5 })
    );

    act(() => result.current.goToPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.goToPage(0));
    expect(result.current.page).toBe(3);

    act(() => result.current.goToPage(6));
    expect(result.current.page).toBe(3);
  });

  it("nextPage and prevPage work within bounds", () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, totalPages: 5 })
    );

    act(() => result.current.nextPage());
    expect(result.current.page).toBe(2);

    act(() => result.current.nextPage());
    expect(result.current.page).toBe(3);

    act(() => result.current.prevPage());
    expect(result.current.page).toBe(2);

    act(() => result.current.goToPage(1));
    act(() => result.current.prevPage());
    expect(result.current.page).toBe(1);

    act(() => result.current.goToPage(5));
    act(() => result.current.nextPage());
    expect(result.current.page).toBe(5);
  });

  it("setLimit resets to page 1", () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, totalPages: 5 })
    );

    act(() => result.current.goToPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.setLimit(10));
    expect(result.current.page).toBe(1);
    expect(result.current.limit).toBe(10);
  });

  it("range calculates correctly", () => {
    const { result: r1 } = renderHook(() =>
      usePagination({ total: 45, totalPages: 5 })
    );
    expect(r1.current.range).toEqual({ start: 1, end: 10 });

    const { result: r2 } = renderHook(() =>
      usePagination({ total: 45, totalPages: 5 })
    );
    act(() => r2.current.goToPage(5));
    expect(r2.current.range).toEqual({ start: 41, end: 45 });
  });

  it("returns to page 1 when total changes to be less than current page", () => {
    const { result, rerender } = renderHook(
      ({ total, totalPages }) => usePagination({ total, totalPages }),
      { initialProps: { total: 100, totalPages: 5 } }
    );

    act(() => result.current.goToPage(3));
    expect(result.current.page).toBe(3);

    rerender({ total: 20, totalPages: 1 });
    expect(result.current.page).toBe(1);
  });
});
