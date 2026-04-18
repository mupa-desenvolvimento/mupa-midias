/**
 * ProductTheme — extrai paleta da imagem do produto via ColorThief
 * e gera cores harmônicas com contraste WCAG ≥ 4.5:1 garantido.
 */
import ColorThief from "colorthief";

export type RGBTuple = [number, number, number];

export interface ProductTheme {
  /** Cor de fundo do card (escura, terrosa por padrão) */
  cardBg: string;
  /** Cor da faixa superior (clara, amarelada por padrão) */
  bandBg: string;
  /** Texto sobre a faixa (contraste ≥ 4.5 com bandBg) */
  bandText: string;
  /** Texto sobre o card (contraste ≥ 4.5 com cardBg) */
  cardText: string;
  /** Cor do retângulo do preço (destaque) */
  priceBg: string;
  /** Texto do preço (contraste ≥ 4.5 com priceBg) */
  priceText: string;
  /** Cor da tarja de oferta */
  offerBg: string;
  offerText: string;
  /** Cor de risco do preço antigo (sempre vermelho legível) */
  strikeColor: string;
}

const FALLBACK: ProductTheme = {
  cardBg: "#8B3A1F",
  bandBg: "#FFD60A",
  bandText: "#8B3A1F",
  cardText: "#FFFFFF",
  priceBg: "#FFD60A",
  priceText: "#111111",
  offerBg: "#E63946",
  offerText: "#FFFFFF",
  strikeColor: "#E63946",
};

const toHex = ([r, g, b]: RGBTuple): string =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;

const relLum = ([r, g, b]: RGBTuple): number => {
  const a = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
};

const contrast = (a: RGBTuple, b: RGBTuple): number => {
  const l1 = relLum(a);
  const l2 = relLum(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

/** Escolhe preto ou branco para garantir contraste ≥ 4.5 */
const readableOn = (bg: RGBTuple): string => {
  const black: RGBTuple = [17, 17, 17];
  const white: RGBTuple = [255, 255, 255];
  return contrast(bg, white) >= contrast(bg, black) ? "#FFFFFF" : "#111111";
};

const rgbToHsl = ([r, g, b]: RGBTuple): [number, number, number] => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s, l];
};

const hslToRgb = (h: number, s: number, l: number): RGBTuple => {
  h /= 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2 = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2(p, q, h + 1 / 3) * 255),
    Math.round(hue2(p, q, h) * 255),
    Math.round(hue2(p, q, h - 1 / 3) * 255),
  ];
};

/** Escurece uma cor até ficar terrosa/escura (L ≤ 0.28), preservando matiz. */
const toEarthyDark = (rgb: RGBTuple): RGBTuple => {
  const [h, s, l] = rgbToHsl(rgb);
  const newS = Math.min(s, 0.55);
  const newL = Math.min(l, 0.22);
  return hslToRgb(h, newS, newL);
};

/** Clareia/satura para virar amarelo-dourado, mantendo viés do matiz original. */
const toGoldenLight = (rgb: RGBTuple): RGBTuple => {
  const [h] = rgbToHsl(rgb);
  // viés para amarelo (45–55°) mas com leve mistura do matiz original
  const yellowH = 48;
  const finalH = (yellowH * 0.75 + h * 0.25) % 360;
  return hslToRgb(finalH, 0.95, 0.58);
};

/** Carrega a imagem com CORS e roda ColorThief. */
const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const t = setTimeout(() => reject(new Error("img-timeout")), 10000);
    img.onload = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); reject(new Error("img-error")); };
    img.src = src;
  });

/**
 * Extrai paleta dominante da imagem e monta o ProductTheme.
 * Retorna FALLBACK se a imagem não puder ser lida (CORS, 404 etc.).
 */
export const generateThemeFromImage = async (
  imageSrc: string | null | undefined,
): Promise<ProductTheme> => {
  if (!imageSrc) return FALLBACK;
  try {
    const img = await loadImage(imageSrc);
    const ct = new ColorThief();
    const palette = (ct.getPalette(img, 6) || []) as RGBTuple[];
    if (!palette.length) return FALLBACK;

    // Filtra cores quase brancas/quase pretas (provável fundo da imagem)
    const usable = palette.filter(([r, g, b]) => {
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const lum = (max + min) / 2;
      return lum > 25 && lum < 235 && sat > 0.12;
    });
    const base: RGBTuple = usable[0] || palette[0];

    const cardRgb = toEarthyDark(base);
    const bandRgb = toGoldenLight(base);
    const priceRgb = bandRgb; // mesmo amarelo do header

    return {
      cardBg: toHex(cardRgb),
      bandBg: toHex(bandRgb),
      bandText: readableOn(bandRgb),
      cardText: readableOn(cardRgb),
      priceBg: toHex(priceRgb),
      priceText: readableOn(priceRgb),
      offerBg: "#E63946",
      offerText: "#FFFFFF",
      strikeColor: "#E63946",
    };
  } catch {
    return FALLBACK;
  }
};

export const getFallbackTheme = (): ProductTheme => FALLBACK;
