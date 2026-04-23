import { beforeEach, describe, expect, it, vi } from "vitest";

const listWordsPageMock = vi.fn();

vi.mock("@/features/japanese-dictionary/application/JapaneseDictionaryService", () => ({
  JapaneseDictionaryService: class {
    listWordsPage = listWordsPageMock;
  },
}));

vi.mock(
  "@/features/japanese-dictionary/infrastructure/JapaneseDictionaryRepository",
  () => ({
    JapaneseDictionaryRepository: class {},
  })
);

describe("GET /api/words", () => {
  beforeEach(() => {
    listWordsPageMock.mockReset();
  });

  it("returns the overview list as plain JSON", async () => {
    listWordsPageMock.mockResolvedValue({
      words: [
        {
          wordId: 7,
          word: "抱く",
          pronunciation: "いだく",
          meaningZh: "怀有；心存",
          partOfSpeech: "动词",
          createdAt: "2026-04-22T10:00:00.000Z",
        },
        {
          wordId: 6,
          word: "食べる",
          pronunciation: "たべる",
          meaningZh: "吃；进食",
          partOfSpeech: "动词",
          createdAt: "2026-04-21T10:00:00.000Z",
        },
      ],
      nextCursor: "cursor-2",
    });

    const { GET } = await import("@/app/api/words/route");
    const response = await GET(new Request("http://localhost/api/words?limit=24"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      words: [
        {
          wordId: 7,
          word: "抱く",
          pronunciation: "いだく",
          meaningZh: "怀有；心存",
          partOfSpeech: "动词",
          createdAt: "2026-04-22T10:00:00.000Z",
        },
        {
          wordId: 6,
          word: "食べる",
          pronunciation: "たべる",
          meaningZh: "吃；进食",
          partOfSpeech: "动词",
          createdAt: "2026-04-21T10:00:00.000Z",
        },
      ],
      nextCursor: "cursor-2",
    });
    expect(listWordsPageMock).toHaveBeenCalledWith({
      query: undefined,
      cursor: undefined,
      limit: 24,
    });
  });
});
