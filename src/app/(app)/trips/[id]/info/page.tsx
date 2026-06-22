import { InfoClient } from "@/components/info/InfoClient";

export default async function InfoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InfoClient tripId={id} />;
}
