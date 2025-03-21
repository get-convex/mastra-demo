import type {
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  IndexStats,
  ParamsToArgs,
  QueryResult,
  CreateIndexArgs,
  UpsertVectorArgs,
  QueryVectorArgs,
} from "@mastra/core/vector";
import { MastraVector } from "@mastra/core/vector";
type VectorDoc = {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
};

export class InMemoryVector extends MastraVector {
  private tables: Record<string, VectorDoc[]> = {};
  private dimensions: Record<string, number> = {};
  constructor() {
    super();
  }
  async query<E extends QueryVectorArgs = QueryVectorArgs>(
    ...args: ParamsToArgs<QueryVectorParams> | E
  ): Promise<QueryResult[]> {
    const params = this.normalizeArgs<QueryVectorParams, QueryVectorArgs>(
      "query",
      args,
    );
    const index = this.tables[params.indexName];
    if (!index) return [];
    const scored = index
      .filter(
        (doc) =>
          !params.filter ||
          Object.entries(params.filter).every(
            ([field, value]) => doc.metadata[field] === value,
          ),
      )
      .map((doc) => {
        const score = dotProduct(doc.vector, params.queryVector);
        return { score, doc };
      });
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, params.topK)
      .map((scored) => ({
        id: scored.doc.id,
        score: scored.score,
        ...scored.doc.metadata,
        ...(params.includeVector ? { vector: scored.doc.vector } : {}),
      }));
  }
  // Adds type checks for positional arguments if used
  async upsert<E extends UpsertVectorArgs = UpsertVectorArgs>(
    ...args: ParamsToArgs<UpsertVectorParams> | E
  ): Promise<string[]> {
    const params = this.normalizeArgs<UpsertVectorParams, UpsertVectorArgs>(
      "upsert",
      args,
    );
    const table = this.tables[params.indexName];
    if (!table) throw new Error(`Index ${params.indexName} not found`);
    const normalized = params.vectors.map((vector, index) => {
      if (vector.length !== this.dimensions[params.indexName]) {
        throw new Error(
          `Vector ${index} has wrong dimension: ${vector.length} !== ${this.dimensions[params.indexName]}`,
        );
      }
      // Normalize the vector to unit length
      return vector.map(
        (value) => value / Math.sqrt(dotProduct(vector, vector)),
      );
    });

    const ids = params.ids || params.vectors.map(() => crypto.randomUUID());
    normalized.forEach((vector, index) => {
      const existing = table.find((doc) => doc.id === ids[index]);
      if (existing) {
        existing.vector = vector;
        existing.metadata = params.metadata?.[index] ?? {};
      } else {
        table.push({
          id: ids[index]!,
          vector,
          metadata: params.metadata?.[index] ?? {},
        });
      }
    });
    return ids;
  }
  // Adds type checks for positional arguments if used
  async createIndex<E extends CreateIndexArgs = CreateIndexArgs>(
    ...args: ParamsToArgs<CreateIndexParams> | E
  ): Promise<void> {
    const params = this.normalizeArgs<CreateIndexParams, CreateIndexArgs>(
      "createIndex",
      args,
    );
    this.tables[params.indexName] = [];
    this.dimensions[params.indexName] = params.dimension;
  }

  async listIndexes(): Promise<string[]> {
    return Object.keys(this.tables);
  }

  async describeIndex(indexName: string): Promise<IndexStats> {
    const table = this.tables[indexName];
    const dimension = this.dimensions[indexName];
    if (!table) throw new Error(`Index ${indexName} not found`);
    if (!dimension) throw new Error(`Index ${indexName} has no dimension`);
    return {
      dimension,
      metric: "cosine",
      count: table.length,
    };
  }

  async deleteIndex(indexName: string): Promise<void> {
    delete this.tables[indexName];
    delete this.dimensions[indexName];
  }
}

function dotProduct(a: number[], b: number[]): number {
  return sum(a.map((value, index) => (b[index] ? value * b[index] : 0)));
}

function sum(a: number[]): number {
  return a.reduce((acc, curr) => acc + curr, 0);
}
