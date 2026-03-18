import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Upload, X, FileImage, FileVideo, Loader2, AlertCircle, CheckCircle2,
  FileText, FileSpreadsheet, File as FileIcon, Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MediaUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  folderId?: string | null;
}

// Expanded file types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 
  'image/svg+xml', 'image/bmp', 'image/tiff'
];
const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 
  'video/x-matroska', 'video/ogg', 'video/3gpp'
];
const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac',
  'audio/flac', 'audio/x-m4a'
];
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/json',
  'application/xml',
  'text/html',
  'text/markdown'
];

const ALL_ALLOWED_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_AUDIO_TYPES,
  ...ALLOWED_DOCUMENT_TYPES
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILES = 10;

type FileStatus = 'pending' | 'uploading' | 'complete' | 'error';

interface UploadFile {
  id: string;
  file: File;
  previewUrl: string | null;
  status: FileStatus;
  progress: number;
  error: string | null;
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileIcon;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return FileSpreadsheet;
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('document') || mimeType.startsWith('text/')) return FileText;
  return FileIcon;
};

const getFileType = (mimeType: string): string => {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'image';
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return 'video';
  if (ALLOWED_AUDIO_TYPES.includes(mimeType)) return 'audio';
  return 'document';
};

export function MediaUploadDialog({ open, onOpenChange, onSuccess, folderId }: MediaUploadDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    const fileType = file.type.toLowerCase();
    
    // Check if file type is allowed
    if (!ALL_ALLOWED_TYPES.includes(fileType)) {
      // Try to infer from extension
      const ext = file.name.split('.').pop()?.toLowerCase();
      const extMappings: Record<string, string[]> = {
        'jpg': ['image/jpeg'],
        'jpeg': ['image/jpeg'],
        'png': ['image/png'],
        'gif': ['image/gif'],
        'webp': ['image/webp'],
        'svg': ['image/svg+xml'],
        'mp4': ['video/mp4'],
        'webm': ['video/webm'],
        'mov': ['video/quicktime'],
        'avi': ['video/x-msvideo'],
        'mkv': ['video/x-matroska'],
        'mp3': ['audio/mpeg'],
        'wav': ['audio/wav'],
        'ogg': ['audio/ogg'],
        'flac': ['audio/flac'],
        'm4a': ['audio/x-m4a'],
        'pdf': ['application/pdf'],
        'doc': ['application/msword'],
        'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        'xls': ['application/vnd.ms-excel'],
        'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        'ppt': ['application/vnd.ms-powerpoint'],
        'pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        'txt': ['text/plain'],
        'csv': ['text/csv'],
        'json': ['application/json'],
        'xml': ['application/xml'],
        'html': ['text/html'],
        'md': ['text/markdown'],
      };
      
      if (!ext || !extMappings[ext]) {
        return { 
          valid: false, 
          error: `Tipo não suportado: ${file.type || ext || 'desconhecido'}` 
        };
      }
    }

    if (file.size > MAX_FILE_SIZE) {
      return { 
        valid: false, 
        error: `Arquivo muito grande (máx: ${MAX_FILE_SIZE / (1024 * 1024)}MB)` 
      };
    }

    return { valid: true };
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    // Check max files limit
    const remainingSlots = MAX_FILES - files.length;
    if (remainingSlots <= 0) {
      toast({
        title: "Limite atingido",
        description: `Máximo de ${MAX_FILES} arquivos por vez`,
        variant: "destructive",
      });
      return;
    }

    const filesToAdd = selectedFiles.slice(0, remainingSlots);
    const skipped = selectedFiles.length - filesToAdd.length;

    const newFiles: UploadFile[] = [];
    const errors: string[] = [];

    for (const file of filesToAdd) {
      const validation = validateFile(file);
      
      if (!validation.valid) {
        errors.push(`${file.name}: ${validation.error}`);
        continue;
      }

      // Create preview for images and videos
      let previewUrl: string | null = null;
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        previewUrl = URL.createObjectURL(file);
      }

      newFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        previewUrl,
        status: 'pending',
        progress: 0,
        error: null,
      });
    }

    if (errors.length > 0) {
      toast({
        title: "Alguns arquivos não foram adicionados",
        description: errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n...e mais ${errors.length - 3}` : ''),
        variant: "destructive",
      });
    }

    if (skipped > 0) {
      toast({
        title: "Limite de arquivos",
        description: `${skipped} arquivo(s) ignorado(s). Máximo: ${MAX_FILES}`,
      });
    }

    setFiles(prev => [...prev, ...newFiles]);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [files.length, validateFile, toast]);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const generateVideoThumbnail = useCallback(async (file: File): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      video.onloadeddata = () => {
        video.currentTime = 1;
      };

      video.onseeked = () => {
        canvas.width = 1280;
        canvas.height = 720;
        
        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = 1280 / 720;
        
        let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
        
        if (videoAspect > canvasAspect) {
          sw = video.videoHeight * canvasAspect;
          sx = (video.videoWidth - sw) / 2;
        } else {
          sh = video.videoWidth / canvasAspect;
          sy = (video.videoHeight - sh) / 2;
        }

        ctx?.drawImage(video, sx, sy, sw, sh, 0, 0, 1280, 720);
        
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(video.src);
          resolve(blob);
        }, 'image/jpeg', 0.85);
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(null);
      };

      video.src = URL.createObjectURL(file);
      video.load();
    });
  }, []);

  const generateImageThumbnail = useCallback(async (file: File): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        canvas.width = 1280;
        canvas.height = 720;
        
        const imgAspect = img.width / img.height;
        const canvasAspect = 1280 / 720;
        
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        
        if (imgAspect > canvasAspect) {
          sw = img.height * canvasAspect;
          sx = (img.width - sw) / 2;
        } else {
          sh = img.width / canvasAspect;
          sy = (img.height - sh) / 2;
        }

        ctx?.drawImage(img, sx, sy, sw, sh, 0, 0, 1280, 720);
        
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(img.src);
          resolve(blob);
        }, 'image/jpeg', 0.85);
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        resolve(null);
      };

      img.src = URL.createObjectURL(file);
    });
  }, []);

  const compressImage = useCallback(async (file: File): Promise<File> => {
    // Skip small files or non-resizable formats
    if (file.size < 500 * 1024) return file; // Skip files smaller than 500KB
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;

    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        // Max dimensions (Full HD)
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw with better quality
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to WebP for better compression
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          
          // If optimized is larger, keep original
          if (blob.size >= file.size) {
            resolve(file);
            return;
          }

          console.log(`[ImageOptimizer] Reduced ${file.name} from ${(file.size/1024).toFixed(0)}KB to ${(blob.size/1024).toFixed(0)}KB`);

          const optimizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
            type: 'image/webp',
            lastModified: Date.now(),
          });
          resolve(optimizedFile);
        }, 'image/webp', 0.8);
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        resolve(file);
      };

      img.src = URL.createObjectURL(file);
    });
  }, []);

  const compressVideo = useCallback(async (file: File, onProgress?: (progress: number) => void): Promise<File> => {
    // Skip if not video or too small (e.g. < 20MB)
    if (!file.type.startsWith('video/') || file.size < 20 * 1024 * 1024) return file;

    // Check browser support for MediaRecorder and WebM
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
      ? 'video/webm;codecs=vp9' 
      : 'video/webm';
      
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      console.warn('Video compression not supported by browser');
      return file;
    }

    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.muted = true;
      video.autoplay = true;
      video.src = URL.createObjectURL(file);
      
      // Cleanup helper
      const cleanup = () => {
        URL.revokeObjectURL(video.src);
        video.remove();
      };

      video.onloadedmetadata = () => {
        // Target specs
        const MAX_HEIGHT = 1080;
        const TARGET_BITRATE = 2500000; // 2.5 Mbps
        
        // Current specs
        let width = video.videoWidth;
        let height = video.videoHeight;
        const duration = video.duration;
        const currentBitrate = (file.size * 8) / duration;

        // If already optimized enough, skip
        if (height <= MAX_HEIGHT && currentBitrate < TARGET_BITRATE * 1.5) {
          cleanup();
          resolve(file);
          return;
        }

        // Calculate new dimensions (maintain aspect ratio)
        if (height > MAX_HEIGHT) {
          width = Math.round(width * (MAX_HEIGHT / height));
          height = MAX_HEIGHT;
        }
        // Ensure even dimensions (some codecs require it)
        width = width % 2 === 0 ? width : width - 1;
        height = height % 2 === 0 ? height : height - 1;

        console.log(`[VideoOptimizer] Compressing ${file.name}...`);
        console.log(`Original: ${video.videoWidth}x${video.videoHeight} @ ${(currentBitrate/1000000).toFixed(2)}Mbps`);
        console.log(`Target: ${width}x${height} @ ${(TARGET_BITRATE/1000000).toFixed(2)}Mbps`);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Capture stream from canvas
        const stream = canvas.captureStream(30); // 30 FPS

        // Try to capture audio
        try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContext) {
            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaElementSource(video);
            const dest = audioCtx.createMediaStreamDestination();
            source.connect(dest);
            const audioTrack = dest.stream.getAudioTracks()[0];
            if (audioTrack) {
              stream.addTrack(audioTrack);
            }
          }
        } catch (e) {
          console.warn('Audio compression failed, video will be muted', e);
        }

        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: TARGET_BITRATE
        });

        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          
          console.log(`[VideoOptimizer] Finished. Size: ${(file.size/1024/1024).toFixed(1)}MB -> ${(blob.size/1024/1024).toFixed(1)}MB`);

          if (blob.size < file.size) {
            const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webm", {
              type: 'video/webm',
              lastModified: Date.now()
            });
            cleanup();
            resolve(newFile);
          } else {
            cleanup();
            resolve(file); // Keep original if compression didn't help
          }
        };

        // Start processing
        recorder.start();
        
        // Draw loop
        const draw = () => {
          if (video.paused || video.ended) return;
          ctx?.drawImage(video, 0, 0, width, height);
          requestAnimationFrame(draw);
        };
        
        video.onplay = () => draw();
        
        // Update progress
        video.ontimeupdate = () => {
          if (duration > 0) {
             const percent = (video.currentTime / duration) * 100;
             onProgress?.(percent);
          }
        };
        
        video.onended = () => {
          recorder.stop();
        };

        video.onerror = () => {
          cleanup();
          resolve(file);
        };

        // Start playback to trigger processing
        video.play().catch(e => {
          console.error('Video playback failed:', e);
          cleanup();
          resolve(file);
        });
      };

      video.onerror = () => {
        cleanup();
        resolve(file);
      };
    });
  }, []);

  const uploadSingleFile = useCallback(async (uploadFile: UploadFile): Promise<boolean> => {
    const { file: originalFile, id } = uploadFile;
    let fileToUpload = originalFile;

    try {
      // Update status
      setFiles(prev => prev.map(f => 
        f.id === id ? { ...f, status: 'uploading' as FileStatus, progress: 5 } : f
      ));

      // Optimize Image
      if (getFileType(originalFile.type) === 'image') {
        fileToUpload = await compressImage(originalFile);
      }
      // Optimize Video
      else if (getFileType(originalFile.type) === 'video') {
        // Show optimization status
        setFiles(prev => prev.map(f => 
          f.id === id ? { ...f, progress: 10 } : f
        )); 
        
        fileToUpload = await compressVideo(originalFile, (videoProgress) => {
            // Map 0-100% video progress to 10-50% overall progress
            setFiles(prev => prev.map(f => 
                f.id === id ? { ...f, progress: 10 + (videoProgress * 0.4) } : f
            ));
        });
      }

      // Show optimization feedback
      if (fileToUpload.size < originalFile.size) {
        const savedMB = ((originalFile.size - fileToUpload.size) / 1024 / 1024).toFixed(2);
        const savedKB = ((originalFile.size - fileToUpload.size) / 1024).toFixed(0);
        const percent = ((1 - fileToUpload.size / originalFile.size) * 100).toFixed(0);
        
        toast({
          title: "Otimização Concluída",
          description: `${originalFile.name}: Reduzido em ${Number(savedMB) > 0.1 ? savedMB + 'MB' : savedKB + 'KB'} (${percent}%)`,
          duration: 4000,
        });
      }

      // Generate thumbnail for images and videos
      const fileType = getFileType(fileToUpload.type);
      let thumbnailBlob: Blob | null = null;

      if (fileType === 'video') {
        setFiles(prev => prev.map(f => 
          f.id === id ? { ...f, progress: 20 } : f
        ));
        thumbnailBlob = await generateVideoThumbnail(fileToUpload);
      } else if (fileType === 'image') {
        setFiles(prev => prev.map(f => 
          f.id === id ? { ...f, progress: 20 } : f
        ));
        thumbnailBlob = await generateImageThumbnail(fileToUpload);
      }

      setFiles(prev => prev.map(f => 
        f.id === id ? { ...f, progress: 40 } : f
      ));

      // Upload to server
      const formData = new FormData();
      formData.append('file', fileToUpload);
      // Ensure we send the correct name (e.g. with .webp extension if changed)
      formData.append('fileName', fileToUpload.name); 
      formData.append('fileType', fileToUpload.type);
      if (folderId) {
        formData.append('folderId', folderId);
      }

      const { data: { session } } = await (supabase.auth as any).getSession();
      
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-media`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      setFiles(prev => prev.map(f => 
        f.id === id ? { ...f, progress: 80 } : f
      ));

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Erro ao fazer upload');
      }

      setFiles(prev => prev.map(f => 
        f.id === id ? { ...f, status: 'complete' as FileStatus, progress: 100 } : f
      ));

      return true;
    } catch (error: any) {
      console.error('Upload error:', error);
      setFiles(prev => prev.map(f => 
        f.id === id ? { ...f, status: 'error' as FileStatus, error: error.message, progress: 0 } : f
      ));
      return false;
    }
  }, [generateImageThumbnail, generateVideoThumbnail]);

  const handleUploadAll = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    let successCount = 0;
    let errorCount = 0;

    // Upload sequentially to avoid overwhelming the server
    for (const file of pendingFiles) {
      const success = await uploadSingleFile(file);
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast({
        title: "Upload concluído",
        description: `${successCount} arquivo(s) enviado(s) com sucesso${errorCount > 0 ? `, ${errorCount} com erro` : ''}`,
      });
      onSuccess();
    }

    if (errorCount > 0 && successCount === 0) {
      toast({
        title: "Erro no upload",
        description: "Todos os arquivos falharam",
        variant: "destructive",
      });
    }

    // Close dialog if all succeeded
    if (errorCount === 0) {
      setTimeout(() => {
        handleClose();
      }, 1000);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleClose = () => {
    if (!isUploading) {
      // Cleanup preview URLs
      files.forEach(f => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      setFiles([]);
      onOpenChange(false);
    }
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const completedCount = files.filter(f => f.status === 'complete').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  // Build accept string from all allowed types
  const acceptTypes = [
    '.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.tiff',
    '.mp4,.webm,.mov,.avi,.mkv,.ogv,.3gp',
    '.mp3,.wav,.ogg,.flac,.m4a,.aac',
    '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.xml,.html,.md'
  ].join(',');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload de Mídia</DialogTitle>
          <DialogDescription>
            Imagens, vídeos, áudios, PDFs, planilhas e documentos (máx. {MAX_FILES} arquivos, 100MB cada)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              Clique para selecionar ou arraste arquivos
            </p>
            <p className="text-xs text-muted-foreground">
              {files.length}/{MAX_FILES} arquivos selecionados
            </p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <ScrollArea className="flex-1 max-h-64">
              <div className="space-y-2 pr-4">
                {files.map((uploadFile) => {
                  const Icon = getFileIcon(uploadFile.file.type);
                  const isImage = uploadFile.file.type.startsWith('image/');
                  const isVideo = uploadFile.file.type.startsWith('video/');
                  
                  return (
                    <div
                      key={uploadFile.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      {/* Preview or icon */}
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {uploadFile.previewUrl && isImage ? (
                          <img
                            src={uploadFile.previewUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : uploadFile.previewUrl && isVideo ? (
                          <video
                            src={uploadFile.previewUrl}
                            className="w-full h-full object-cover"
                            muted
                          />
                        ) : (
                          <Icon className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>

                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{uploadFile.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(uploadFile.file.size)}
                        </p>
                        
                        {/* Progress bar */}
                        {uploadFile.status === 'uploading' && (
                          <Progress value={uploadFile.progress} className="h-1 mt-1" />
                        )}
                        
                        {/* Error message */}
                        {uploadFile.status === 'error' && uploadFile.error && (
                          <p className="text-xs text-destructive truncate">{uploadFile.error}</p>
                        )}
                      </div>

                      {/* Status/actions */}
                      <div className="flex-shrink-0">
                        {uploadFile.status === 'pending' && !isUploading && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeFile(uploadFile.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                        {uploadFile.status === 'uploading' && (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        )}
                        {uploadFile.status === 'complete' && (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                        {uploadFile.status === 'error' && (
                          <AlertCircle className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          <Input
            ref={fileInputRef}
            type="file"
            accept={acceptTypes}
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              {completedCount > 0 && <span className="text-green-600">{completedCount} enviado(s)</span>}
              {errorCount > 0 && <span className="text-destructive ml-2">{errorCount} erro(s)</span>}
            </div>
            
            <div className="flex gap-2">
              {files.length > 0 && !isUploading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    files.forEach(f => {
                      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
                    });
                    setFiles([]);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
              )}
              <Button variant="outline" onClick={handleClose} disabled={isUploading}>
                Cancelar
              </Button>
              <Button
                onClick={handleUploadAll}
                disabled={pendingCount === 0 || isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Enviar {pendingCount > 0 ? `(${pendingCount})` : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
