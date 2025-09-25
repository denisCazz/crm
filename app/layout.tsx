import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// app/layout.tsx
import "leaflet/dist/leaflet.css";

export const metadata = {
  title: "Bitora CRM",
  description: "CRM minimale e veloce per PMI.",
  metadataBase: new URL("https://crm-3xm8.vercel.app"),
};


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
