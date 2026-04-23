import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();

vi.mock("@/shared/db/query", () => ({
  query: queryMock,
}));

describe("JapaneseDictionaryRepository", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("normalizes bigint-backed word ids to numbers in overview results", async () => {
    queryMock.mockResolvedValue([
      {
        word_id: "9",
        word: "巡る",
        pronunciation: "めぐる",
        meaning_zh: "围绕；巡回",
        created_at: "2026-04-22T11:55:54.956Z",
      },
    ]);

    const { JapaneseDictionaryRepository } = await import(
      "@/features/japanese-dictionary/infrastructure/JapaneseDictionaryRepository"
    );

    const repository = new JapaneseDictionaryRepository();

    await expect(repository.listOverviewEntries()).resolves.toEqual([
      {
        wordId: 9,
        word: "巡る",
        pronunciation: "めぐる",
        meaningZh: "围绕；巡回",
        createdAt: "2026-04-22T11:55:54.956Z",
      },
    ]);
  });

  it("returns a dictionary entry detail by id with a normalized word id", async () => {
    queryMock.mockResolvedValue([
      {
        word_id: "8",
        word: "巡る",
        pronunciation: "めぐる",
        meaning_zh: "围绕；巡回",
        part_of_speech: "动词",
        examples: [
          {
            japanese: "季節が巡る。",
            reading: "きせつ が めぐる。",
            translationZh: "季节轮转。",
          },
          {
            japanese: "町を巡る。",
            reading: "まち を めぐる。",
            translationZh: "在城里巡行。",
          },
          {
            japanese: "話題が巡る。",
            reading: "わだい が めぐる。",
            translationZh: "话题流转。",
          },
        ],
        created_at: "2026-04-22T11:55:54.956Z",
      },
    ]);

    const { JapaneseDictionaryRepository } = await import(
      "@/features/japanese-dictionary/infrastructure/JapaneseDictionaryRepository"
    );

    const repository = new JapaneseDictionaryRepository();

    await expect(repository.findEntryDetailById(8)).resolves.toEqual({
      wordId: 8,
      word: "巡る",
      pronunciation: "めぐる",
      meaningZh: "围绕；巡回",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "季節が巡る。",
          reading: "きせつ が めぐる。",
          translationZh: "季节轮转。",
        },
        {
          japanese: "町を巡る。",
          reading: "まち を めぐる。",
          translationZh: "在城里巡行。",
        },
        {
          japanese: "話題が巡る。",
          reading: "わだい が めぐる。",
          translationZh: "话题流转。",
        },
      ],
      createdAt: "2026-04-22T11:55:54.956Z",
    });
  });
});
