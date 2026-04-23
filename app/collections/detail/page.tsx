import Link from "next/link";
import { notFound } from "next/navigation";
import { CollectionWordGrid } from "@/app/components/collection-word-grid";
import { AppBrandIcon, CollectionIcon } from "@/app/components/icons";
import { CollectionService } from "@/features/collections/application/CollectionService";
import { CollectionRepository } from "@/features/collections/infrastructure/CollectionRepository";
import { NotFoundError } from "@/shared/utils/errors";

type CollectionDetailPageProps = {
  searchParams: Promise<{
    collectionId?: string;
    added?: string;
  }>;
};

const collectionService = new CollectionService(new CollectionRepository());

function formatWordCount(count: number) {
  return `${count} 个单词`;
}

export default async function CollectionDetailPage({
  searchParams,
}: CollectionDetailPageProps) {
  const { collectionId: rawCollectionId, added: rawAddedCount } = await searchParams;
  const collectionId = Number(rawCollectionId);
  const addedCount =
    rawAddedCount && Number.isInteger(Number(rawAddedCount))
      ? Number(rawAddedCount)
      : 0;

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
            href="/?view=collections"
            className="inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-sm text-white/48 transition hover:border-white/18 hover:text-white/66"
          >
            返回 collections
          </Link>

          {addedCount > 0 ? (
            <div className="mt-5 rounded-[18px] border border-white/10 bg-[#1a2218cc] px-5 py-4 text-white/72">
              <p className="text-sm leading-6">已成功添加 {addedCount} 个词条。</p>
            </div>
          ) : null}

          <div className="mt-5 rounded-[22px] border border-white/10 bg-[#1e1e1ecc] p-[clamp(20px,2.8vw,28px)] shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-white/28">
                  Collection
                </p>
                <h1 className="mt-3 break-words text-[clamp(28px,4vw,36px)] font-medium tracking-[-0.04em] text-white/80">
                  {collection.name}
                </h1>
                {collection.description ? (
                  <p className="mt-3 max-w-[44rem] text-sm leading-6 text-white/42">
                    {collection.description}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-3 self-start rounded-[16px] border border-white/10 bg-white/5 px-4 py-3">
                <CollectionIcon className="size-5 text-white/42" />
                <div>
                  <p className="text-sm font-medium text-white/66">
                    {formatWordCount(collection.wordCount)}
                  </p>
                  <p className="text-xs text-white/30">当前 collection 内容</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Link
              href={`/collections/add?collectionId=${collection.collectionId}`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-white/10 px-5 text-sm font-medium text-white/74 transition hover:bg-white/14"
            >
              添加单词
            </Link>
          </div>

          <CollectionWordGrid
            collectionId={collection.collectionId}
            words={collection.words}
          />
        </div>
      </section>
    </main>
  );
}
