// nova press · the mythos · ambient types for the hyphen package's per-language
// entry points (the package ships no declarations). only what we use: the sync
// plain-text hyphenator, which inserts soft hyphens by the tex patterns.
declare module "hyphen/en" {
  export interface HyphenationOptions {
    hyphenChar?: string;
    minWordLength?: number;
  }
  export function hyphenateSync(text: string, options?: HyphenationOptions): string;
  export function hyphenate(text: string, options?: HyphenationOptions): Promise<string>;
}
