import { redirect } from "next/navigation";

type LegacyCollectionDetailPageProps = {
  params: Promise<{
    collectionId: string;
  }>;
};

export default async function LegacyCollectionDetailPage({
  params,
}: LegacyCollectionDetailPageProps) {
  const { collectionId } = await params;
  redirect(`/collections/detail?collectionId=${encodeURIComponent(collectionId)}`);
}
