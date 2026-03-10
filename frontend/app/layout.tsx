import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AuthProvider } from "@/context/AuthContext";
import { CursorGlow } from "@/components/CursorGlow";
import VertexBackground from "@/components/VertexBackground";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Vertex",
  description: "Vertex — Where talent meets opportunity",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.className} min-h-screen flex flex-col`}
        style={{
          background: "linear-gradient(165deg, #1e1b4b 0%, #2d2a5c 35%, #3d2c6e 70%, #4c3d7a 100%)",
          backgroundAttachment: "fixed",
          minHeight: "100vh",
          color: "#ffffff",
        }}
      >
        <VertexBackground />
        <AuthProvider>
          <CursorGlow />
          <Navbar />
          <main className="flex-1 relative z-10">{children}</main>
          <Footer />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
