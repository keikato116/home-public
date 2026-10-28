"use client";

import { useRecipePhoto } from "@/lib/recipePhotos";

// レシピ写真の <img>。非公開のバケットの写真は、期限つきの URL に置き換えてから表示する
// （src/lib/recipePhotos.ts）。URL が届くまでは同じ大きさの空白を出す。
export function RecipePhoto({ src, alt, className, placeholderClassName }: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  /** URL が届くまでの空白の大きさ。省略時は className と同じ */
  placeholderClassName?: string;
}) {
  const resolved = useRecipePhoto(src);
  if (!resolved) return <div className={placeholderClassName ?? className} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={resolved} alt={alt} className={className} />;
}
