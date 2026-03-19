/**
 * Unified content type definitions for the entire system.
 * Used by MediaLibrary, MediaRenderer, Player, and Android API.
 */

export const CONTENT_TYPES = [
  'image',
  'video',
  'webview',
  'weather',
  'news',
  'motivational',
  'curiosity',
  'birthday',
  'nutrition',
  'instagram',
  'campaign',
] as const;

export type ContentType = typeof CONTENT_TYPES[number];

export interface ContentTypeInfo {
  value: ContentType;
  label: string;
  icon: string; // lucide icon name
  hasFile: boolean; // whether the content has a file_url
  defaultDuration: number;
}

export const CONTENT_TYPE_MAP: Record<ContentType, ContentTypeInfo> = {
  image:        { value: 'image',        label: 'Imagem',              icon: 'Image',       hasFile: true,  defaultDuration: 10 },
  video:        { value: 'video',        label: 'Vídeo',               icon: 'Video',       hasFile: true,  defaultDuration: 0  },
  weather:      { value: 'weather',      label: 'Clima',               icon: 'CloudSun',    hasFile: false, defaultDuration: 15 },
  news:         { value: 'news',         label: 'Notícias',            icon: 'Newspaper',   hasFile: false, defaultDuration: 20 },
  motivational: { value: 'motivational', label: 'Frases Motivacionais',icon: 'MessageCircleHeart', hasFile: false, defaultDuration: 10 },
  curiosity:    { value: 'curiosity',    label: 'Curiosidades',        icon: 'Lightbulb',   hasFile: false, defaultDuration: 10 },
  birthday:     { value: 'birthday',     label: 'Aniversariantes',     icon: 'Cake',        hasFile: false, defaultDuration: 15 },
  nutrition:    { value: 'nutrition',     label: 'Nutrição',            icon: 'Apple',       hasFile: false, defaultDuration: 10 },
  instagram:    { value: 'instagram',    label: 'Instagram',           icon: 'Instagram',   hasFile: false, defaultDuration: 10 },
  campaign:     { value: 'campaign',     label: 'QR Code Campanhas',   icon: 'QrCode',      hasFile: false, defaultDuration: 10 },
};

/** Filter options for MediaLibrary panels */
export const MEDIA_FILTER_OPTIONS = [
  { value: 'all',          label: 'Todos' },
  { value: 'image',        label: 'Imagens' },
  { value: 'video',        label: 'Vídeos' },
  { value: 'weather',      label: 'Clima' },
  { value: 'news',         label: 'Notícias' },
  { value: 'motivational', label: 'Frases' },
  { value: 'curiosity',    label: 'Curiosidades' },
  { value: 'birthday',     label: 'Aniversários' },
  { value: 'nutrition',    label: 'Nutrição' },
  { value: 'instagram',    label: 'Instagram' },
  { value: 'campaign',     label: 'Campanhas' },
];

/**
 * Resolves the playable source for a content item.
 * For file-based types returns file_url, for dynamic types returns metadata-driven source.
 */
export function resolveContentSrc(type: string, fileUrl: string | null, metadata?: any): string | null {
  switch (type) {
    case 'instagram':
      return metadata?.instagram_url || metadata?.src || fileUrl;
    case 'campaign':
      return metadata?.campaign_url || metadata?.qr_url || fileUrl;
    default:
      return fileUrl;
  }
}

/**
 * Determines if a content type should be rendered in an iframe.
 */
export function isIframeType(type: string): boolean {
  return ['instagram'].includes(type);
}

/**
 * Gets the YouTube embed URL from a regular YouTube URL.
 * Kept for backward compatibility but YouTube is not a primary content type.
 */
export function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  if (url.includes('youtube.com/embed/')) return url;
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1&controls=0&loop=1`;
    }
  }
  
  return url;
}
