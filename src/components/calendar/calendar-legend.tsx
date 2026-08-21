import { channelColors } from "@/lib/calendar/channel-colors";

const BAR_STATES = [
  { label: "Activa", dotClass: "bg-success" },
  { label: "Próxima", dotClass: "bg-info" },
  { label: "Cancelada", dotClass: "bg-destructive" },
  { label: "Finalizada", dotClass: "bg-muted-foreground" },
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
      {/* Reservation bar states */}
      <div className="flex items-center gap-x-3 gap-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Estado
        </span>
        <div className="flex items-center gap-x-2">
          {BAR_STATES.map(({ label, dotClass }) => (
            <div
              key={label}
              className="inline-flex items-center gap-1.5"
            >
              <span
                className={`inline-block h-2 w-2 rounded-md ${dotClass}`}
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
