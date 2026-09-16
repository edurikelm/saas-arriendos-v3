/**
 * Punto con el color de la propiedad: el mismo que la identifica en
 * `/calendar`, así que el inicio y el calendario se leen con la misma clave.
 * Es identidad, no estado — el estado lo dicen las palabras de cada fila.
 *
 * `property.color` es dato del usuario; sin él cae a `--primary` (DESIGN.md).
 */
export function PropertyDot({ color }: { color?: string | null }) {
  return (
    <span
      aria-hidden="true"
      className="size-2 shrink-0 rounded-full ring-1 ring-foreground/10"
      style={{ backgroundColor: color || "var(--primary)" }}
    />
  );
}
