import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { channelColors } from "@/lib/calendar/channel-colors";

const STATUS_STATES = [
  { label: "Pendiente", icon: AlertCircle, colorClass: "text-muted-foreground" },
  { label: "Confirmada", icon: CheckCircle2, colorClass: "text-success" },
  { label: "Cancelada", icon: XCircle, colorClass: "text-destructive" },
  { label: "Completada", icon: CheckCircle2, colorClass: "text-muted-foreground" },
] as const;

const CHANNELS = [
  { letter: "A", label: "Airbnb", dotClass: channelColors.AIRBNB.dotClass },
  { letter: "B", label: "Booking", dotClass: channelColors.BOOKING_COM.dotClass },
  { letter: "V", label: "VRBO", dotClass: channelColors.VRBO.dotClass },
  { letter: "?", label: "Otro", dotClass: channelColors.OTHER.dotClass },
] as const;

interface CalendarLegendProps {
  showChannels?: boolean;
}

export function CalendarLegend({ showChannels = false }: CalendarLegendProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5"
      aria-label="Leyenda del calendario"
    >
      {/* Reservation bar states — icons match the StatusIcon rendered inside each bar */}
      <div className="flex items-center gap-x-3 gap-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Estado
        </span>
        <div className="flex items-center gap-x-2">
          {STATUS_STATES.map(({ label, icon: Icon, colorClass }) => (
            <div
              key={label}
              className="inline-flex items-center gap-1"
            >
              <Icon
                className={`h-3 w-3 shrink-0 ${colorClass}`}
                aria-hidden="true"
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      {showChannels && (
        <div
          className="h-4 w-px bg-border"
          aria-hidden="true"
        />
      )}

      {/* External channel letters */}
      {showChannels && (
        <div className="flex items-center gap-x-3 gap-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Canal
          </span>
          <div className="flex items-center gap-x-2">
            {CHANNELS.map(({ letter, label, dotClass }) => (
              <div
                key={label}
                className="inline-flex items-center gap-1"
              >
                <span
                  className={`inline-block h-2 w-2 rounded-md ${dotClass}`}
                  aria-hidden="true"
                />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {letter}{" "}
                  <span className="font-normal normal-case tracking-normal">
                    {label}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}