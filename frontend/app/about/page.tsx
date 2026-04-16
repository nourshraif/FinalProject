import type { Metadata } from "next";
import AboutPageClient from "./AboutPageClient";

export const metadata: Metadata = {
  title: "About Vertex — AI-Powered Job Matching",
  description:
    "Learn about Vertex, the AI-powered platform connecting skilled professionals with the companies that need them. Built with vector embeddings and semantic matching.",
};

export default function AboutPage() {
  return <AboutPageClient />;
}

