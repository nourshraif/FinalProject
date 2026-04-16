import type { Metadata } from "next";
import ContactPageClient from "./ContactPageClient";

export const metadata: Metadata = {
  title: "Contact Us | Vertex",
  description: "Get in touch with the Vertex team for support, partnerships, or general inquiries.",
};

export default function ContactPage() {
  return <ContactPageClient />;
}

