/**
 * Unified content type definitions for the entire system.
 * Used by MediaLibrary, MediaRenderer, Player, and Android API.
 */

export const CONTENT_TYPES = [
  'image',
  'video',
  'url',
  'youtube',
  'html',
  'news',
  'weather',
  'widget',
  'table',
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
  image:     { value: 'image',     label: 'Imagem',       icon: 'Image',      hasFile: true,  defaultDuration: 10 },
  video:     { value: 'video',     label: 'Vídeo',        icon: 'Video',      hasFile: true,  defaultDuration: 0  },
  url:       { value: 'url',       label: 'URL / Webview',icon: 'Globe',      hasFile: false, defaultDuration: 15 },
  youtube:   { value: 'youtube',   label: 'YouTube',      icon: 'Youtube',    hasFile: false, defaultDuration: 30 },
  html:      { value: 'html',      label: 'HTML',         icon: 'Code',       hasFile: false, defaultDuration: 15 },
  news:      { value: 'news',      label: 'Notícias',     icon: 'Newspaper',  hasFile: false, defaultDuration: 20 },
  weather:   { value: 'weather',   label: 'Clima',        icon: 'CloudSun',   hasFile: false, defaultDuration: 15 },
  widget:    { value: 'widget',    label: 'Widget',       icon: 'LayoutGrid', hasFile: false, defaultDuration: 15 },
  table:     { value: 'table',     label: 'Tabela Preço', icon: 'Table',      hasFile: false, defaultDuration: 15 },
  instagram: { value: 'instagram', label: 'Instagram',    icon: 'Instagram',  hasFile: false, defaultDuration: 10 },
  campaign:  { value: 'campaign',  label: 'Campanha',     icon: 'Megaphone',  hasFile: true,  defaultDuration: 10 },
};

/** Filter options for MediaLibrary panels */
export const MEDIA_FILTER_OPTIONS = [
  { value: 'all',       label: 'Todos' },
  { value: 'image',     label: 'Imagens' },
  { value: 'video',     label: 'Vídeos' },
  { value: 'url',       label: 'URLs' },
  { value: 'youtube',   label: 'YouTube' },
  { value: 'html',      label: 'HTML' },
  { value: 'news',      label: 'Notícias' },
  { value: 'weather',   label: 'Clima' },
  { value: 'widget',    label: 'Widgets' },
  { value: 'table',     label: 'Tabelas' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'campaign',  label: 'Campanhas' },
];

/**
 * Resolves the playable source for a content item.
 * For file-based types returns file_url, for dynamic types returns metadata-driven source.
 */
export function resolveContentSrc(type: string, fileUrl: string | null, metadata?: any): string | null {
  switch (type) {
    case 'url':
      return metadata?.url || metadata?.src || fileUrl;
    case 'youtube':
      return metadata?.youtube_url || metadata?.url || fileUrl;
    case 'html':
      return metadata?.html_content || metadata?.src || fileUrl;
    case 'widget':
      return metadata?.widget_url || metadata?.src || fileUrl;
    case 'table':
      return metadata?.table_url || metadata?.src || fileUrl;
    case 'instagram':
      return metadata?.instagram_url || metadata?.src || fileUrl;
    case 'campaign':
      return metadata?.campaign_url || fileUrl;
    default:
      return fileUrl;
  }
}

/**
 * Determines if a content type should be rendered in an iframe.
 */
export function isIframeType(type: string): boolean {
  return ['url', 'youtube', 'html', 'widget', 'table', 'instagram'].includes(type);
}

/**
 * Gets the YouTube embed URL from a regular YouTube URL.
 */
export function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  
  // Already an embed URL
  if (url.includes('youtube.com/embed/')) return url;
  
  // Extract video ID from various YouTube URL formats
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
