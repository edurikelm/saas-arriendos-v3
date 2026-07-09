import * as React from "react";
import { cn } from "@/lib/utils";

export type DataTableHeaderAlign = "left" | "right" | "center";

export type DataTableHeader =
  | string
  | { label: string; align?: DataTableHeaderAlign };

interface DataTableProps {
  headers: DataTableHeader[];
  children?: React.ReactNode;
  emptyState?: React.ReactNode;
  caption?: string;
  className?: string;
}

function normalizeHeader(header: DataTableHeader): { label: string; align: DataTableHeaderAlign } {
  if (typeof header === "string") {
    return { label: header, align: "left" };
  }
  return { label: header.label, align: header.align ?? "left" };
}

function alignClass(align: DataTableHeaderAlign): string {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

export function DataTable({ headers, children, emptyState, caption, className }: DataTableProps) {
  return (
    <div className={cn("overflow-hidden rounded-md border border-border bg-card", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b bg-muted/50">
              {headers.map((header, idx) => {
                const { label, align } = normalizeHeader(header);
                return (
                  <th
                    key={`${label}-${idx}`}
                    className={cn(
                      "px-6 py-4 align-middle text-[10px] font-bold uppercase tracking-wider text-muted-foreground",
                      alignClass(align)
                    )}
                  >
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="text-xs">
            {children}
            {(!children || (Array.isArray(children) && children.length === 0)) && emptyState ? (
              <tr>
                <td colSpan={headers.length} className="px-6 py-10 text-center align-middle text-sm text-muted-foreground">
                  {emptyState}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
