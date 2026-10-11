// WebP client-side (SPEC v3 §4, DS §4.12, emenda v3.1 #8): só puros aqui;
// canvas/upload vivem em components/ui/image-uploader.tsx (runtime browser).
export const MAX_IMAGE_BYTES = 1024 * 1024; // 1MB — rejeita só APÓS compressão
export const MAX_IMAGE_WIDTH = 1200; // dimensão nunca rejeita: redimensiona

export const shouldRejectType = (mime: string) => !mime.startsWith("image/");

// qualidade 80–100 por tamanho de entrada; o loop de compressão tenta até caber em 1MB
export const pickQuality = (bytes: number) => (bytes <= 200 * 1024 ? 1 : bytes <= 1024 * 1024 ? 0.9 : 0.8);
