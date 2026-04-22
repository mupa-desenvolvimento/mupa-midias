import { useEffect, useMemo, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Settings,
  RefreshCw,
  Clock,
  HelpCircle,
  LogOut,
  UserCog,
  Crown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useDevices } from "@/hooks/useDevices";
import { useChannels } from "@/hooks/useChannels";
import { useUserCompany } from "@/hooks/useUserCompany";
import { useTenantLicense } from "@/hooks/useTenantLicense";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const getGreeting = (hour: number) => {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
};

const formatTime = (date: Date) =>
  date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

const formatDate = (date: Date) =>
  date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const Header = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { devices } = useDevices();
  const { channels } = useChannels();
  const { company } = useUserCompany();
  const { license } = useTenantLicense();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Live clock — updates every minute (granularity HH:MM)
  useEffect(() => {
    const tick = () => setNow(new Date());
    // Sync to next minute boundary, then every 60s
    const msUntilNextMinute = 60_000 - (Date.now() % 60_000);
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const timeoutId = setTimeout(() => {
      tick();
      intervalId = setInterval(tick, 60_000);
    }, msUntilNextMinute);
    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const greeting = useMemo(() => getGreeting(now.getHours()), [now]);

  const userName = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, any>;
    const full = meta.full_name || meta.name;
    if (full) return String(full).split(" ")[0];
    if (user?.email) return user.email.split("@")[0];
    return "Operador";
  }, [user]);

  const userInitials = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, any>;
    const full = meta.full_name || meta.name;
    if (full) {
      const parts = String(full).trim().split(" ").filter(Boolean);
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    }
    return user?.email?.slice(0, 2).toUpperCase() || "U";
  }, [user]);

  // Smart status — counts
  const onlineDevices = useMemo(
    () =>
      devices.filter((d) => d.status === "online" && d.is_active).length,
    [devices]
  );
  const totalDevices = devices.length;
  const activeChannels = useMemo(
    () => channels.filter((c) => c.is_active).length,
    [channels]
  );

  // Health: green = all online, amber = some offline, red = nothing online & has devices
  const health: "ok" | "warn" | "error" =
    totalDevices === 0
      ? "ok"
      : onlineDevices === 0
      ? "error"
      : onlineDevices < totalDevices
      ? "warn"
      : "ok";

  const healthLabel = {
    ok: "Tudo funcionando normalmente",
    warn: "Alguns dispositivos offline",
    error: "Nenhum dispositivo online",
  }[health];

  const healthDot = {
    ok: "bg-emerald-500",
    warn: "bg-amber-500",
    error: "bg-rose-500",
  }[health];

  const planLabel =
    license?.plan === "lite"
      ? "LITE"
      : license?.plan === "standard"
      ? "STANDARD"
      : license?.plan === "enterprise"
      ? "ENTERPRISE"
      : null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-3 md:px-4 gap-3">
        <SidebarTrigger className="h-8 w-8 shrink-0" />
        <Separator orientation="vertical" className="h-6 hidden md:block" />

        {/* LEFT — Greeting + smart status */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <span className="text-base md:text-lg leading-tight" aria-hidden>
              👋
            </span>
            <h1 className="text-sm md:text-base leading-tight truncate">
              <span className="text-muted-foreground font-normal">
                {greeting},
              </span>{" "}
              <span className="font-semibold text-foreground">{userName}!</span>
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", healthDot)} />
              {healthLabel}
            </span>
            <span className="opacity-40">•</span>
            <span>
              <span className="font-medium text-emerald-500">
                {onlineDevices}
              </span>{" "}
              dispositivos online
            </span>
            <span className="opacity-40">•</span>
            <span>
              <span className="font-medium text-foreground">
                {activeChannels}
              </span>{" "}
              campanhas ativas
            </span>
          </div>
        </div>

        {/* CENTER/RIGHT — Clock */}
        <div className="hidden lg:flex flex-col items-end leading-tight mr-1">
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground tabular-nums">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            {formatTime(now)}
          </div>
          <span className="text-[10px] text-muted-foreground capitalize">
            {formatDate(now)}
          </span>
        </div>

        <Separator orientation="vertical" className="h-6 hidden lg:block" />

        {/* RIGHT — Quick actions */}
        <div className="flex items-center gap-0.5">
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRefresh}
                aria-label="Atualizar dados"
              >
                <RefreshCw
                  className={cn(
                    "w-4 h-4 transition-transform",
                    isRefreshing && "animate-spin"
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Atualizar dados</TooltipContent>
          </Tooltip>

          <ThemeToggle />

          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => navigate("/admin/settings")}
                aria-label="Configurações"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Configurações</TooltipContent>
          </Tooltip>

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="ml-1 relative flex items-center justify-center rounded-full ring-2 ring-transparent hover:ring-border transition-all focus-visible:outline-none focus-visible:ring-primary/40"
                aria-label="Menu do perfil"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold leading-none truncate">
                    {userName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {company && (
                <div className="px-2 py-1.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Empresa
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-tight truncate">
                    {company.name}
                  </p>
                  {planLabel && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Plano
                      </span>
                      <Badge
                        variant={planLabel === "LITE" ? "secondary" : "default"}
                        className="text-[10px] px-1.5 py-0 h-4 gap-1"
                      >
                        {planLabel !== "LITE" && (
                          <Crown className="w-2.5 h-2.5" />
                        )}
                        {planLabel}
                      </Badge>
                    </div>
                  )}
                </div>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/admin/settings")}>
                <UserCog className="w-4 h-4 mr-2" />
                Gerenciar conta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/admin/settings")}>
                <Settings className="w-4 h-4 mr-2" />
                Preferências
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  window.open("https://docs.lovable.dev", "_blank")
                }
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                Ajuda
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair da conta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;
