declare module "pg" {
  export class Pool {
    constructor(config?: { connectionString?: string; max?: number });
    query<T = unknown>(
      text: string,
      values?: readonly unknown[]
    ): Promise<{ rows: T[] }>;
    end(): Promise<void>;
  }
}

