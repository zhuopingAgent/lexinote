import { redirect } from "next/navigation";

type LegacyNestedCollectionDetailPageProps = {
  params: Promise<{
    collectionId: string;
  }>;
};

export default async function LegacyNestedCollectionDetailPage({
  params,
}: LegacyNestedCollectionDetailPageProps) {
  const { collectionId } = await params;
  redirect(`/collections/detail?collectionId=${encodeURIComponent(collectionId)}`);
}
