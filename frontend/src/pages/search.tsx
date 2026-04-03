import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Search as SearchIcon, Loader2, FileText, Brain, Database, Layers } from "lucide-react";
import { useSearchDocuments } from "@/api";

export default function SearchPage() {
  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [hasSearched, setHasSearched] = useState(false);

  const searchMutation = useSearchDocuments();

  useEffect(() => {
    if (initialQuery) {
      setHasSearched(true);
      searchMutation.mutate({ data: { query: initialQuery, top_k: 5 } });
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setHasSearched(true);
    searchMutation.mutate({ data: { query, top_k: 5 } });
    window.history.replaceState(null, "", `/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <Layout>
      <div className="space-y-8 max-w-4xl mx-auto w-full">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Search</h1>
          <p className="text-muted-foreground mt-1">
            Semantic search powered by FAISS + all-MiniLM-L6-v2.
          </p>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Ask a question or enter keywords..."
              className="pl-10 py-6 text-base"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="px-8"
            disabled={searchMutation.isPending || !query.trim()}
          >
            {searchMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Search"
            )}
          </Button>
        </form>

        {/* Results */}
        <div className="space-y-4">
          {searchMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Searching knowledge base…</p>
            </div>
          )}

          {searchMutation.isSuccess && searchMutation.data && (
            <>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {searchMutation.data.total}
                </span>{" "}
                result{searchMutation.data.total !== 1 ? "s" : ""} for{" "}
                <span className="italic">"{searchMutation.data.query}"</span>
              </p>

              <div className="space-y-4">
                {searchMutation.data.results.map((result) => (
                  <Card
                    key={result.document_id}
                    className="overflow-hidden hover:border-primary/50 transition-colors"
                  >
                    <CardHeader className="bg-muted/30 pb-3 border-b">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-primary shrink-0" />
                          <CardTitle className="text-base leading-tight">
                            {result.title}
                          </CardTitle>
                        </div>
                        <span className="shrink-0 text-xs font-mono bg-primary/10 text-primary px-2.5 py-1 rounded-full font-semibold">
                          {(result.score * 100).toFixed(1)}% match
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                        {result.excerpt}
                      </p>
                    </CardContent>
                  </Card>
                ))}

                {searchMutation.data.results.length === 0 && (
                  <Card className="border-dashed bg-transparent">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <SearchIcon className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                      <p className="text-lg font-medium">No results found</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Try rephrasing your query or uploading more documents.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}

          {!hasSearched && !searchMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-14 text-center opacity-40">
              <SearchIcon className="w-16 h-16 mb-4" />
              <h3 className="text-xl font-semibold">Start Searching</h3>
              <p className="max-w-md mt-2 text-sm">
                Ask full questions in natural language for the best semantic matches.
              </p>
            </div>
          )}
        </div>

        {/* How it works */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              How Semantic Search Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <Layers className="w-4 h-4 text-primary" />
                  1. Chunking
                </div>
                <p>
                  Uploaded documents are split into overlapping 512-word windows (64-word
                  overlap) so large files can be searched at chunk granularity.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <Brain className="w-4 h-4 text-primary" />
                  2. Encoding — all-MiniLM-L6-v2
                </div>
                <p>
                  Each chunk and your query are encoded into a 384-dimensional vector by the
                  pretrained sentence-transformers model, capturing semantic meaning beyond
                  exact keywords.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <Database className="w-4 h-4 text-primary" />
                  3. FAISS Retrieval
                </div>
                <p>
                  Vectors are stored in a FAISS IndexFlatIP index. Cosine similarity
                  (inner product on L2-normalized vectors) ranks chunks, and the best chunk
                  per document is returned as the result.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
