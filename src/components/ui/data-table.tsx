import * as React from "react";
import { Card } from "@/components/ui/card";

interface DataTableProps {
  headers: string[];
  children?: React.ReactNode;
  emptyState?: React.ReactNode;
  caption?: string;
}

export function DataTable({ headers, children, emptyState, caption }: DataTableProps) {
  return (
    <Card className="ring-1 ring-foreground/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b text-left">
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
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
                <td colSpan={headers.length}>
                  {emptyState}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
