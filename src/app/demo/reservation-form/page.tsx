import { ReservationFormShowcase } from "@/prototypes/reservation-form-prototypes";
import { ReservationFormDesignSystemShowcase } from "@/prototypes/reservation-form-design-system";

export default function ReservationFormDemoPage() {
  return (
    <div className="space-y-16">
      <ReservationFormShowcase />
      <hr className="border-border" />
      <div>
        <h1 className="text-2xl font-bold mb-2 px-6">Design System Variants</h1>
        <p className="text-muted-foreground mb-6 px-6">Formularios alineados al DESIGN.md</p>
        <ReservationFormDesignSystemShowcase />
      </div>
    </div>
  );
}
