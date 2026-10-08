import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace";
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
  return <Workspace section={section} />;
}
