import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";
import { WordCard } from "@/app/components/word-card";
import { mapEntryToWordData } from "@/app/lib/word-data";
import { CollectionService } from "@/features/collections/application/CollectionService";
import { CollectionRepository } from "@/features/collections/infrastructure/CollectionRepository";
import { JapaneseDictionaryService } from "@/features/japanese-dictionary/application/JapaneseDictionaryService";
import { JapaneseDictionaryRepository } from "@/features/japanese-dictionary/infrastructure/JapaneseDictionaryRepository";
import { VocabularyCoreService } from "@/features/vocabulary-core/application/VocabularyCoreService";
import { NotFoundError } from "@/shared/utils/errors";
import { getTopNavigationItems } from "@/app/lib/top-navigation";

type CollectionWordDetailPageProps = {
  searchParams: Promise<{
    collectionId?: string;
    wordId?: string;
  }>;
};

const collectionService = new CollectionService(new CollectionRepository());
const vocabularyCoreService = new VocabularyCoreService(
  new JapaneseDictionaryService(new JapaneseDictionaryRepository())
);
export default async function CollectionWordDetailPage({
  searchParams,
}: CollectionWordDetailPageProps) {
  const { collectionId: rawCollectionId, wordId: rawWordId } = await searchParams;
  const collectionId = Number(rawCollectionId);
  const wordId = Number(rawWordId);

  if (
    !Number.isInteger(collectionId) ||
    collectionId <= 0 ||
    !Number.isInteger(wordId) ||
    wordId <= 0
  ) {
    notFound();
  }

  let collection;

  try {
    collection = await collectionService.getCollectionDetail(collectionId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const collectionWord = collection.words.find((word) => word.wordId === wordId);

  if (!collectionWord) {
    notFound();
  }

  const entry = await vocabularyCoreService.getEntryDetail(wordId);

  if (!entry) {
    notFound();
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <AppHeader navItems={getTopNavigationItems("dictionary")} />

      <section className="px-[clamp(16px,4vw,40px)] py-[clamp(28px,4vw,48px)]">
        <div className="mx-auto w-full max-w-[960px]">
          <Link
            href={`/collections/detail?collectionId=${collection.collectionId}`}
            className="inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-sm text-white/48 transition hover:border-white/18 hover:text-white/66"
          >
            返回 {collection.name}
          </Link>

          <div className="mt-5 flex justify-center sm:justify-start">
            <WordCard word={mapEntryToWordData(entry)} />
          </div>
        </div>
      </section>
    </main>
  );
}
