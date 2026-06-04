import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Pagination } from "../pagination";

describe("Pagination", () => {
  it("does not render when totalPages <= 1", () => {
    const { container } = render(
      <Pagination
        page={1}
        totalPages={1}
        total={10}
        onPageChange={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders correct page info text", () => {
    render(
      <Pagination
        page={1}
        totalPages={5}
        total={100}
        limit={20}
        onPageChange={vi.fn()}
      />
    );
    expect(
      screen.getByText("Mostrando 1-20 de 100 resultados")
    ).toBeDefined();
  });

  it("previous button is disabled on first page", () => {
    render(
      <Pagination
        page={1}
        totalPages={5}
        total={100}
        onPageChange={vi.fn()}
      />
    );
    const prevButton = screen.getByText("Anterior");
    expect((prevButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("next button is disabled on last page", () => {
    render(
      <Pagination
        page={5}
        totalPages={5}
        total={100}
        onPageChange={vi.fn()}
      />
    );
    const nextButton = screen.getByText("Siguiente");
    expect((nextButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls onPageChange when clicking a page number", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        page={2}
        totalPages={5}
        total={100}
        onPageChange={onPageChange}
      />
    );

    fireEvent.click(screen.getByText("3"));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("renders ellipsis correctly for many pages", () => {
    render(
      <Pagination
        page={5}
        totalPages={10}
        total={200}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("4")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();
    expect(screen.getByText("6")).toBeDefined();
    expect(screen.getByText("10")).toBeDefined();

    const ellipsisElements = screen.getAllByText("...");
    expect(ellipsisElements).toHaveLength(2);
  });
});
