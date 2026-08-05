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
  /** Minimum table width in any CSS unit (e.g. "640px"). Defaults to "640px" to enable
   * natural horizontal scroll on mobile viewports (e.g. 375px) without truncating
   * column content. */
  minWidth?: string;
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

export function DataTable({ headers, children, emptyState, caption, className, minWidth = "640px" }: DataTableProps) {
  return (
    <div className={cn("overflow-hidden rounded-md border border-t-2 border-t-primary border-border bg-card", className)}>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth }}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b bg-muted/50">
              {headers.map((header, idx) => {
                const { label, align } = normalizeHeader(header);
                return (
                  <th
                    key={`${label}-${idx}`}
                    scope="col"
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
