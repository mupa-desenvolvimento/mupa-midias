/**
 * Extrai a cor dominante de uma imagem usando canvas
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ExtractedColors {
  dominant: RGB;
  vibrant: RGB;
  muted: RGB;
  isDark: boolean;
}

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h * 360, s * 100, l * 100];
};

const hslToRgb = (h: number, s: number, l: number): RGB => {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
};

const getLuminance = (rgb: RGB): number => {
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
};

/**
 * Preloads an image and returns the HTMLImageElement for reuse
 */
export const preloadImage = (imageUrl: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    const timeout = setTimeout(() => {
      img.src = "";
      reject(new Error("Image load timeout"));
    }, 12000);

    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      // Retry once without crossOrigin (won't allow canvas extraction but will display)
      const fallback = new Image();
      const fallbackTimeout = setTimeout(() => {
        fallback.src = "";
        reject(new Error("Image load failed"));
      }, 10000);

      fallback.onload = () => {
        clearTimeout(fallbackTimeout);
        resolve(fallback);
      };
      fallback.onerror = () => {
        clearTimeout(fallbackTimeout);
        reject(new Error("Image load failed after retry"));
      };
      fallback.src = imageUrl;
    };
    
    img.src = imageUrl;
  });
};

/**
 * Extract colors from an already loaded HTMLImageElement (no extra download)
 */
export const extractColorsFromElement = (img: HTMLImageElement): ExtractedColors => {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    
    if (!ctx) return getDefaultColors();

    const sampleSize = 40;
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
    
    let imageData: ImageData;
    try {
      imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    } catch {
      // Canvas tainted (CORS) – return defaults
      console.warn("[ColorExtractor] Canvas tainted, using defaults");
      return getDefaultColors();
    }

    return processPixelData(imageData);
  } catch {
    return getDefaultColors();
  }
};

/**
 * Legacy: Extract colors from URL (downloads image internally)
 */
export const extractColors = (imageUrl: string): Promise<ExtractedColors> => {
  return new Promise((resolve) => {
    preloadImage(imageUrl)
      .then((img) => resolve(extractColorsFromElement(img)))
      .catch(() => resolve(getDefaultColors()));
  });
};

function processPixelData(imageData: ImageData): ExtractedColors {
  const pixels = imageData.data;
  const colorCounts: Map<string, { rgb: RGB; count: number; saturation: number }> = new Map();
  
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    
    if (a < 128) continue;
    const luminance = (r + g + b) / 3;
    if (luminance < 20 || luminance > 235) continue;
    
    const qr = Math.round(r / 16) * 16;
    const qg = Math.round(g / 16) * 16;
    const qb = Math.round(b / 16) * 16;
    const key = `${qr},${qg},${qb}`;
    
    const [, saturation] = rgbToHsl(r, g, b);
    
    const existing = colorCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorCounts.set(key, { rgb: { r: qr, g: qg, b: qb }, count: 1, saturation });
    }
  }
  
  const sortedColors = Array.from(colorCounts.values())
    .sort((a, b) => b.count - a.count);
  
  if (sortedColors.length === 0) return getDefaultColors();
  
  const dominant = sortedColors.find(c => c.saturation > 20)?.rgb || sortedColors[0].rgb;
  
  const vibrant = [...sortedColors]
    .sort((a, b) => b.saturation - a.saturation)[0]?.rgb || dominant;
  
  const [h, , l] = rgbToHsl(dominant.r, dominant.g, dominant.b);
  const muted = hslToRgb(h, 30, Math.min(l, 40));
  
  const isDark = getLuminance(dominant) < 0.5;
  
  return { dominant, vibrant, muted, isDark };
}

export const getDefaultColors = (): ExtractedColors => ({
  dominant: { r: 30, g: 58, b: 95 },
  vibrant: { r: 59, g: 130, b: 246 },
  muted: { r: 30, g: 41, b: 59 },
  isDark: true,
});

export const rgbToString = (rgb: RGB): string => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
export const rgbToRgba = (rgb: RGB, alpha: number): string => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;

export const generateGradient = (colors: ExtractedColors): string => {
  const { dominant, muted } = colors;
  return `linear-gradient(135deg, ${rgbToString(muted)} 0%, ${rgbToString(dominant)} 50%, ${rgbToRgba(dominant, 0.8)} 100%)`;
};

export const generateBackgroundStyle = (colors: ExtractedColors): React.CSSProperties => {
  return {
    background: generateGradient(colors),
  };
};
