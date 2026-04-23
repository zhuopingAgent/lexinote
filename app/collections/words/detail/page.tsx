import Link from "next/link";
import { notFound } from "next/navigation";
import { WordCard } from "@/app/components/word-card";
import { AppBrandIcon } from "@/app/components/icons";
import { mapEntryToWordData } from "@/app/lib/word-data";
import { CollectionService } from "@/features/collections/application/CollectionService";
import { CollectionRepository } from "@/features/collections/infrastructure/CollectionRepository";
import { JapaneseDictionaryService } from "@/features/japanese-dictionary/application/JapaneseDictionaryService";
import { JapaneseDictionaryRepository } from "@/features/japanese-dictionary/infrastructure/JapaneseDictionaryRepository";
import { NotFoundError } from "@/shared/utils/errors";

type CollectionWordDetailPageProps = {
  searchParams: Promise<{
    collectionId?: string;
    wordId?: string;
  }>;
};

const collectionService = new CollectionService(new CollectionRepository());
const dictionaryService = new JapaneseDictionaryService(
  new JapaneseDictionaryRepository()
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

  const entry = await dictionaryService.getEntryDetail(wordId);

  if (!entry) {
    notFound();
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-black/50 bg-[#1e1e1ecc]">
        <div className="mr-auto flex h-[clamp(56px,6vw,60px)] w-full max-w-[1160px] items-center gap-[clamp(24px,5vw,48px)] pl-[clamp(16px,4vw,32px)] pr-[clamp(16px,3vw,24px)]">
          <Link href="/" className="flex items-center gap-2.5">
            <AppBrandIcon className="size-[clamp(22px,2.5vw,24px)] text-accent" />
            <p className="text-[clamp(17px,2.3vw,20px)] font-medium tracking-[-0.03em] text-white/70">
              LexiNote
            </p>
          </Link>

          <nav
            className="flex items-center gap-[clamp(12px,2.4vw,24px)] whitespace-nowrap"
            aria-label="Primary"
          >
            <span className="text-[clamp(13px,1.8vw,16px)] text-white/45">辞書</span>
            <span className="text-[clamp(13px,1.8vw,16px)] text-white/60">
              コレクション
            </span>
          </nav>
        </div>
      </header>

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
