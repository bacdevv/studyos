import { notFound } from "next/navigation";
const sections = [
  "dashboard",
  "habits",
  "study",
  "analytics",
  "history",
  "settings",
];
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  // The authenticated layout renders the persistent workspace.
  return null;
}
