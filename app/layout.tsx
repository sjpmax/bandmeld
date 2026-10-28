import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { ThemePicker } from "@/components/theme-picker";
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
 * Runs synchronously before paint. Reads the user's choices from
 * localStorage ("theme" for light/dark, "theme-name" for the visual
 * theme) and sets both on <html> so Tailwind + the theme CSS match
 * before the first paint — no flash of the wrong look.
 */
const NO_FLASH_SCRIPT = `(function(){try{
  var s=localStorage.getItem('theme');
  var sys=window.matchMedia('(prefers-color-scheme: dark)').matches;
  var d=s==='dark'||(!s&&sys);
  if(d)document.documentElement.classList.add('dark');
  var t=localStorage.getItem('theme-name')||'default';
  if(t!=='default'&&t!=='memphis'&&t!=='comic'&&t!=='xp'&&t!=='deco')t='default';
  document.documentElement.setAttribute('data-theme',t);
}catch(e){document.documentElement.setAttribute('data-theme','default');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="default" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bangers&family=Comic+Neue:wght@400;700&family=Inter:wght@400;500;600;700;800&family=Limelight&family=Playfair+Display:wght@400;700;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Poiret+One&family=Rubik+Mono+One&family=Rubik:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh font-sans antialiased">
        <ThemePicker />
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
