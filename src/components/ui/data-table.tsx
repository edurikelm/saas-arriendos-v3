import * as React from "react";
import { cn } from "@/lib/utils";

interface DataTableProps {
  headers: string[];
  children?: React.ReactNode;
  emptyState?: React.ReactNode;
  caption?: string;
  className?: string;
}

export function DataTable({ headers, children, emptyState, caption, className }: DataTableProps) {
  return (
    <div className={cn("overflow-hidden rounded-md border border-border bg-card", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-6 py-4 text-left align-middle text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
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
