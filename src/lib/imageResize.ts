"use client";

// レシピ写真を縮めてから保存・送信する。
//
// スマホの写真はそのままだと1枚3MB前後あり、Supabase の無料枠（保存1GB・転送月5GB）を
// すぐに使い切る。送信サイズが Vercel の上限（4.5MB）を超えて、取り込みが失敗することもあった。
//
//   保存用（手元で見る） … 長辺 2048px。本のページを撮っても、2倍くらいに拡大して読める
//   Claude に送る用       … 長辺 1568px。Claude はこれより大きい画像を自分で縮めて読むので、
//                           これ以上大きくしても読み取りの精度は上がらない

export const STORAGE_MAX_EDGE = 2048;
export const ANALYZE_MAX_EDGE = 1568;
const JPEG_QUALITY = 0.82;

/** 長辺が maxEdge に収まる大きさ。もともと小さければそのまま。 */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  // createImageBitmap は写真の向き（EXIF）を反映して読める
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // 下の <img> で読む
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 長辺 maxEdge の JPEG にする。読めない形式だったり、縮めても小さくならない場合は
 * 元のファイルをそのまま返す（保存や取り込みそのものは止めない）。
 */
export async function resizeImage(file: File, maxEdge: number): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    return file;
  }

  try {
    const { width, height } = fitWithin(decoded.width, decoded.height, maxEdge);
    // すでに小さい JPEG なら作り直さない（画質を落とすだけになる）
    if (width === decoded.width && file.type === "image/jpeg" && file.size < 1024 * 1024) return file;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(decoded.source, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    decoded.close();
  }
}
