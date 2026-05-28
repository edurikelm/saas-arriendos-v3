import { jsPDF } from "jspdf";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outputPath = resolve("docs", "mercado-pago-flow.pdf");
const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();

const colors = {
  bg: [247, 250, 252],
  ink: [24, 35, 48],
  muted: [91, 107, 127],
  border: [189, 201, 216],
  owner: [31, 104, 172],
  app: [20, 121, 89],
  mp: [113, 72, 177],
  warn: [180, 92, 26],
  softBlue: [232, 242, 255],
  softGreen: [231, 248, 240],
  softPurple: [242, 236, 255],
  softOrange: [255, 244, 230],
};

function setColor(color) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function fill(color) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function stroke(color) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function box({ x, y, w, h, title, lines, fillColor, accentColor }) {
  fill(fillColor);
  stroke(colors.border);
  doc.setLineWidth(1.2);
  doc.roundedRect(x, y, w, h, 10, 10, "FD");

  fill(accentColor);
  doc.roundedRect(x, y, 8, h, 4, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(colors.ink);
  doc.text(title, x + 18, y + 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setColor(colors.muted);
  let cursor = y + 38;
  for (const line of lines) {
    doc.text(line, x + 18, cursor);
    cursor += 12;
  }
}

function arrow(x1, y1, x2, y2, label) {
  stroke(colors.muted);
  doc.setLineWidth(1.1);
  doc.line(x1, y1, x2, y2);

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 7;
  const a1 = angle - Math.PI / 7;
  const a2 = angle + Math.PI / 7;
  doc.line(x2, y2, x2 - size * Math.cos(a1), y2 - size * Math.sin(a1));
  doc.line(x2, y2, x2 - size * Math.cos(a2), y2 - size * Math.sin(a2));

  if (label) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(colors.muted);
    doc.text(label, (x1 + x2) / 2 - 28, (y1 + y2) / 2 - 6);
  }
}

function sectionTitle(text, x, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setColor(colors.ink);
  doc.text(text, x, y);
}

fill(colors.bg);
doc.rect(0, 0, pageWidth, pageHeight, "F");

doc.setFont("helvetica", "bold");
doc.setFontSize(22);
setColor(colors.ink);
doc.text("Flujo Mercado Pago - RentalPro", 36, 42);

doc.setFont("helvetica", "normal");
doc.setFontSize(9.5);
setColor(colors.muted);
doc.text("OAuth por owner + Checkout Pro + webhook firmado. Produccion usa cuentas reales y tokens encriptados por owner.", 36, 60);

sectionTitle("1. Conexion OAuth", 36, 91);

box({
  x: 36,
  y: 105,
  w: 150,
  h: 76,
  title: "Owner en Settings",
  lines: ["Click: Conectar Mercado Pago", "Debe estar autenticado", "Cuenta MP real en produccion"],
  fillColor: colors.softBlue,
  accentColor: colors.owner,
});

box({
  x: 225,
  y: 105,
  w: 170,
  h: 76,
  title: "RentalPro OAuth start",
  lines: ["Genera state + PKCE", "Guarda verifier temporal", "Redirect a Mercado Pago"],
  fillColor: colors.softGreen,
  accentColor: colors.app,
});

box({
  x: 436,
  y: 105,
  w: 170,
  h: 76,
  title: "Mercado Pago Auth",
  lines: ["Autoriza APP_ID", "Valida redirect_uri", "Devuelve code + state"],
  fillColor: colors.softPurple,
  accentColor: colors.mp,
});

box({
  x: 648,
  y: 105,
  w: 158,
  h: 76,
  title: "OAuth callback",
  lines: ["Valida state", "POST /oauth/token", "Encripta access/refresh"],
  fillColor: colors.softGreen,
  accentColor: colors.app,
});

arrow(186, 143, 225, 143, "start");
arrow(395, 143, 436, 143, "authorize");
arrow(606, 143, 648, 143, "callback");

sectionTitle("2. Generacion de link Checkout Pro", 36, 220);

box({
  x: 36,
  y: 235,
  w: 155,
  h: 88,
  title: "Owner genera link",
  lines: ["Reserva o pago pendiente", "Payment local PENDING", "method=MERCADO_PAGO"],
  fillColor: colors.softBlue,
  accentColor: colors.owner,
});

box({
  x: 230,
  y: 235,
  w: 165,
  h: 88,
  title: "Token del owner",
  lines: ["getMercadoPagoToken(userId)", "Refresca si expiro", "Sin token: error Settings"],
  fillColor: colors.softGreen,
  accentColor: colors.app,
});

box({
  x: 435,
  y: 235,
  w: 176,
  h: 88,
  title: "Crear preferencia MP",
  lines: ["POST /checkout/preferences", "external_reference", "notification_url + paymentId"],
  fillColor: colors.softPurple,
  accentColor: colors.mp,
});

box({
  x: 651,
  y: 235,
  w: 155,
  h: 88,
  title: "Guardar link",
  lines: ["mercadoPagoId=preference_id", "initPoint=init_point", "sandbox_init_point no principal"],
  fillColor: colors.softGreen,
  accentColor: colors.app,
});

arrow(191, 279, 230, 279, "crear");
arrow(395, 279, 435, 279, "token");
arrow(611, 279, 651, 279, "respuesta");

sectionTitle("3. Pago, webhook y actualizacion", 36, 363);

box({
  x: 36,
  y: 378,
  w: 136,
  h: 86,
  title: "Comprador paga",
  lines: ["Usa init_point", "Otra cuenta/tarjeta", "MP procesa pago"],
  fillColor: colors.softBlue,
  accentColor: colors.owner,
});

box({
  x: 203,
  y: 378,
  w: 158,
  h: 86,
  title: "Webhook firmado",
  lines: ["x-signature + request-id", "data.id/type o id/topic", "401 si firma invalida"],
  fillColor: colors.softPurple,
  accentColor: colors.mp,
});

box({
  x: 392,
  y: 378,
  w: 158,
  h: 86,
  title: "Resolver owner",
  lines: ["1) paymentId hint", "2) external_reference", "3) preference_id / payment_id"],
  fillColor: colors.softGreen,
  accentColor: colors.app,
});

box({
  x: 581,
  y: 378,
  w: 136,
  h: 86,
  title: "Consultar MP",
  lines: ["GET /v1/payments/{id}", "o /merchant_orders/{id}", "Token del owner"],
  fillColor: colors.softPurple,
  accentColor: colors.mp,
});

box({
  x: 748,
  y: 378,
  w: 72,
  h: 86,
  title: "BD",
  lines: ["status", "paidAt", "reserva"],
  fillColor: colors.softGreen,
  accentColor: colors.app,
});

arrow(172, 421, 203, 421, "notifica");
arrow(361, 421, 392, 421, "parse");
arrow(550, 421, 581, 421, "owner");
arrow(717, 421, 748, 421, "update");

sectionTitle("Variables y reglas criticas", 36, 505);

box({
  x: 36,
  y: 520,
  w: 250,
  h: 56,
  title: "Produccion",
  lines: ["APP_URL https sin slash final", "CLIENT_ID numerico + CLIENT_SECRET", "WEBHOOK_SECRET real, test flags=false"],
  fillColor: colors.softOrange,
  accentColor: colors.warn,
});

box({
  x: 316,
  y: 520,
  w: 250,
  h: 56,
  title: "Seguridad",
  lines: ["No usar MERCADOPAGO_ACCESS_TOKEN global", "No completar pago por redirect", "No permitir firma invalida en prod"],
  fillColor: colors.softOrange,
  accentColor: colors.warn,
});

box({
  x: 596,
  y: 520,
  w: 224,
  h: 56,
  title: "Operacion",
  lines: ["Owner conecta en /settings", "Generar links nuevos tras cambiar env", "Logs: OAuth, webhook, matching"],
  fillColor: colors.softOrange,
  accentColor: colors.warn,
});

doc.setFont("helvetica", "normal");
doc.setFontSize(7.5);
setColor(colors.muted);
doc.text("Fuente: CONTEXT.md, ADR-0001 y ADR-0013. Generado por scripts/generate-mercadopago-flow-pdf.mjs", 36, pageHeight - 18);

writeFileSync(outputPath, Buffer.from(doc.output("arraybuffer")));
console.log(`PDF generated: ${outputPath}`);
