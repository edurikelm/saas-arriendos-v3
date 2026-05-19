import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "RentalPro - Sistema de Administración de Arriendos",
  description: "SaaS para gestionar propiedades en arriendo",
  other: {
    "color-scheme": "light dark",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className={geist.variable}>
      <body className="font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="rentalpro-theme">
          <TooltipProvider delay={300}>
            {children}
          </TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
