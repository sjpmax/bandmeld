import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BandMeld", template: "%s · BandMeld" },
  description: "Band availability, hosted EPKs and turnkey show packages for DIY bands.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Runs synchronously before paint. Reads the user's choice from
 * localStorage ("light" | "dark" | missing = system) and sets the
 * `.dark` class on <html> so Tailwind's dark: utilities match before
 * the first paint — no light-mode flash in dark mode.
 */
const NO_FLASH_SCRIPT = `(function(){try{var s=localStorage.getItem('theme');var sys=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=s==='dark'||(!s&&sys);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="min-h-dvh font-sans antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
