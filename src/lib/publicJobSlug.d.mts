export interface PublicJobSlugInput {
  id?: string | null;
  title?: string | null;
  location?: string | null;
}
export declare function publicJobSlug(job: PublicJobSlugInput): string;
