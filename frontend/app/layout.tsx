import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ScrollToTop } from "@/components/ScrollToTop";
import { StitchBackdrop } from "@/components/StitchBackdrop";
import ChatBot from "@/components/ChatBot";

export const metadata: Metadata = {
  title: "Vertex | Talent Matching",
  description: "Vertex — Where talent meets opportunity",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Manrope:wght@400;500;600;700;800&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
        />
      </head>
      <body
        className="font-body flex min-h-screen flex-col selection:bg-v-primary/30"
      >
        <StitchBackdrop />
        <AuthProvider>
          <ToastProvider>
            <ErrorBoundary>
              <Navbar />
            </ErrorBoundary>
            <ErrorBoundary>
              <main className="page-enter relative z-10 flex-1">{children}</main>
            </ErrorBoundary>
            <Footer />
            <ChatBot />
            <ScrollToTop />
            <Toaster richColors position="top-right" />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
