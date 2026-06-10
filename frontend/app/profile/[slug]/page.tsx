import { redirect } from "next/navigation";

/** Legacy /profile/{slug} URLs → canonical /u/{slug} */
export default function LegacyPublicProfileRedirect({
  params,
}: {
  params: { slug: string };
}) {
  redirect(`/u/${params.slug}`);
}
