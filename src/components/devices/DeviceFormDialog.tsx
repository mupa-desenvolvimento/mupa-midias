import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw } from "lucide-react";
import { useStores } from "@/hooks/useStores";
import { usePlaylists } from "@/hooks/usePlaylists";
import { usePriceCheckIntegrations } from "@/hooks/usePriceCheckIntegrations";
import { DeviceInsert, DeviceWithRelations, DeviceUpdate } from "@/hooks/useDevices";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  device_code: z.string().min(4, "Código deve ter pelo menos 4 caracteres"),
  store_id: z.string().optional(),
  current_playlist_id: z.string().optional(),
  price_integration_id: z.string().optional(),
  resolution: z.string().optional(),
  camera_enabled: z.boolean().default(false),
  store_code: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface DeviceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device?: DeviceWithRelations | null;
  onSubmit: (data: DeviceInsert | (DeviceUpdate & { id: string })) => Promise<void>;
  isLoading?: boolean;
}

function generateDeviceCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function DeviceFormDialog({
  open,
  onOpenChange,
  device,
  onSubmit,
  isLoading = false,
}: DeviceFormDialogProps) {
  const { stores, isLoading: storesLoading } = useStores();
  const { playlists, isLoading: playlistsLoading } = usePlaylists();
  const { integrations, isLoading: integrationsLoading } = usePriceCheckIntegrations();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: device?.name || "",
      device_code: device?.device_code || generateDeviceCode(),
      store_id: device?.store_id || undefined,
      current_playlist_id: device?.current_playlist_id || undefined,
      price_integration_id: device?.price_integration_id || undefined,
      resolution: device?.resolution || "1920x1080",
      camera_enabled: device?.camera_enabled || false,
      store_code: (device as any)?.store_code || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: device?.name || "",
        device_code: device?.device_code || generateDeviceCode(),
        store_id: device?.store_id || undefined,
        current_playlist_id: device?.current_playlist_id || undefined,
        price_integration_id: device?.price_integration_id || undefined,
        resolution: device?.resolution || "1920x1080",
        camera_enabled: device?.camera_enabled || false,
        store_code: (device as any)?.store_code || "",
      });
    }
  }, [device, open, form]);

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      if (device) {
        await onSubmit({
          id: device.id,
          name: data.name,
          store_id: data.store_id || null,
          current_playlist_id: data.current_playlist_id || null,
          price_integration_id: data.price_integration_id || null,
          resolution: data.resolution || null,
          camera_enabled: data.camera_enabled,
          store_code: data.store_code || null,
        } as any);
      } else {
        await onSubmit({
          device_code: data.device_code,
          name: data.name,
          store_id: data.store_id || null,
          current_playlist_id: data.current_playlist_id || null,
          price_integration_id: data.price_integration_id || null,
          resolution: data.resolution || null,
          camera_enabled: data.camera_enabled,
          store_code: data.store_code || null,
        } as any);
      }
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting device:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateCode = () => {
    form.setValue("device_code", generateDeviceCode());
  };

  const isEditing = !!device;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Dispositivo" : "Novo Dispositivo"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize as informações do dispositivo."
              : "Preencha as informações para cadastrar um novo dispositivo."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Dispositivo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: TV Entrada Principal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="device_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código do Dispositivo</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        placeholder="ABCD1234"
                        {...field}
                        disabled={isEditing}
                        className="font-mono uppercase"
                      />
                    </FormControl>
                    {!isEditing && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleGenerateCode}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <FormDescription>
                    Código único usado para identificar o dispositivo. Use no player: /play/{field.value}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="store_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loja</FormLabel>
                  <Select
                    value={field.value || "none"}
                    onValueChange={(value) =>
                      field.onChange(value === "none" ? undefined : value)
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma loja" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sem loja</SelectItem>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.code} - {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="current_playlist_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Playlist</FormLabel>
                  <Select
                    value={field.value || "none"}
                    onValueChange={(value) =>
                      field.onChange(value === "none" ? undefined : value)
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma playlist" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {playlists.map((playlist) => (
                        <SelectItem key={playlist.id} value={playlist.id}>
                          {playlist.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Playlist que será exibida neste dispositivo
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="resolution"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resolução</FormLabel>
                  <Select
                    value={field.value || "1920x1080"}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a resolução" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1920x1080">1920x1080 (Full HD)</SelectItem>
                      <SelectItem value="1280x720">1280x720 (HD)</SelectItem>
                      <SelectItem value="800x1280">800x1280 (Tablet Vertical)</SelectItem>
                      <SelectItem value="1080x1920">1080x1920 (Full HD Vertical)</SelectItem>
                      <SelectItem value="3840x2160">3840x2160 (4K)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price_integration_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Integração de Preço</FormLabel>
                  <Select
                    value={field.value || "none"}
                    onValueChange={(value) =>
                      field.onChange(value === "none" ? undefined : value)
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma integração" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {integrations?.map((integration) => (
                        <SelectItem key={integration.id} value={integration.id}>
                          {integration.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Integração usada para consulta de preços neste dispositivo
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="store_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código da Filial (Consulta Preço)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: 8"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Código da filial usado nas consultas de preço da API
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="camera_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Câmera IA</FormLabel>
                    <FormDescription>
                      Ativar reconhecimento facial e análise de audiência
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || isLoading}>
                {isSubmitting || isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : isEditing ? (
                  "Salvar"
                ) : (
                  "Cadastrar"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
