import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBrandIcon, CollectionIcon } from "@/app/components/icons";
import { CollectionWordPicker } from "@/app/components/collection-word-picker";
import { CollectionService } from "@/features/collections/application/CollectionService";
import { CollectionRepository } from "@/features/collections/infrastructure/CollectionRepository";
import { JapaneseDictionaryService } from "@/features/japanese-dictionary/application/JapaneseDictionaryService";
import { JapaneseDictionaryRepository } from "@/features/japanese-dictionary/infrastructure/JapaneseDictionaryRepository";
import { NotFoundError } from "@/shared/utils/errors";

type CollectionAddPageProps = {
  searchParams: Promise<{
    collectionId?: string;
  }>;
};

const collectionService = new CollectionService(new CollectionRepository());
const dictionaryService = new JapaneseDictionaryService(
  new JapaneseDictionaryRepository()
);

function formatWordCount(count: number) {
  return `${count} 个单词`;
}

export default async function CollectionAddPage({
  searchParams,
}: CollectionAddPageProps) {
  const { collectionId: rawCollectionId } = await searchParams;
  const collectionId = Number(rawCollectionId);

  if (!Number.isInteger(collectionId) || collectionId <= 0) {
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

  const entryCandidates = await dictionaryService.listEntryCandidates();
  const existingWordIds = collection.words.map((word) => word.wordId);

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
            返回 collection 详情
          </Link>

          <div className="mt-5 rounded-[22px] border border-white/10 bg-[#1e1e1ecc] p-[clamp(20px,2.8vw,28px)] shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-white/28">
                  Add To Collection
                </p>
                <h1 className="mt-3 break-words text-[clamp(28px,4vw,36px)] font-medium tracking-[-0.04em] text-white/80">
                  {collection.name}
                </h1>
                <p className="mt-3 max-w-[42rem] text-sm leading-6 text-white/42">
                  通过勾选列表或搜索结果，把本地词典中的词条加入这个 collection。
                </p>
              </div>

              <div className="flex items-center gap-3 self-start rounded-[16px] border border-white/10 bg-white/5 px-4 py-3">
                <CollectionIcon className="size-5 text-white/42" />
                <div>
                  <p className="text-sm font-medium text-white/66">
                    {formatWordCount(collection.wordCount)}
                  </p>
                  <p className="text-xs text-white/30">当前已收录词条数</p>
                </div>
              </div>
            </div>
          </div>

          <CollectionWordPicker
            collectionId={collection.collectionId}
            entries={entryCandidates}
            existingWordIds={existingWordIds}
          />
        </div>
      </section>
    </main>
  );
}
