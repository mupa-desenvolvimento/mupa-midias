import { useState, useRef, useEffect, useCallback } from "react";
import { Barcode, Search, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Capacitor } from "@capacitor/core";

const RESET_CODE = "050223";

// Configurações otimizadas para WebView/Kodular
const SCANNER_CHAR_THRESHOLD = 50; // ms entre caracteres para detectar scanner (aumentado para Zebra/Motorola)
const AUTO_SUBMIT_DELAY = 80; // ms após último caractere para submeter automaticamente
const MIN_EAN_LENGTH = 1; // Aceita códigos internos curtos
const MAX_EAN_LENGTH = 20; // Limite máximo de dígitos

interface EanInputProps {
  onSubmit: (ean: string) => void;
  isVisible: boolean;
  disabled?: boolean;
  onFocus?: () => void;
  onReset?: () => void;
  alwaysListenForScanner?: boolean;
}

export const EanInput = ({ 
  onSubmit, 
  isVisible, 
  disabled, 
  onFocus, 
  onReset,
  alwaysListenForScanner = false 
}: EanInputProps) => {
  const [value, setValue] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const isNative = Capacitor.isNativePlatform();
  
  // Refs para detecção de scanner e auto-submit
  const lastKeyTimeRef = useRef<number>(0);
  const isScannerInputRef = useRef<boolean>(false);
  const autoSubmitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bufferRef = useRef<string>("");

  // Foca no input quando mídias visíveis ou alwaysListenForScanner ativo
  // Em plataformas nativas, também foca - readOnly + inputMode="none" impede o teclado
  useEffect(() => {
    const shouldFocus = (isVisible || alwaysListenForScanner) && !disabled && hiddenInputRef.current;
    if (shouldFocus) {
      // Delays escalonados para garantir que WebView está pronto na inicialização
      const delays = [100, 500, 1000, 2000];
      const timeouts = delays.map(delay =>
        setTimeout(() => {
          if (hiddenInputRef.current && document.activeElement !== hiddenInputRef.current) {
            hiddenInputRef.current.focus({ preventScroll: true });
          }
        }, delay)
      );
      return () => timeouts.forEach(clearTimeout);
    }
  }, [isVisible, disabled, alwaysListenForScanner]);

  // Refoca agressivamente - crítico para WebViews e plataformas nativas
  useEffect(() => {
    const shouldListen = isVisible || alwaysListenForScanner;
    if (!shouldListen || disabled) return;

    const interval = setInterval(() => {
      if (hiddenInputRef.current && document.activeElement !== hiddenInputRef.current) {
        hiddenInputRef.current.focus({ preventScroll: true });
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isVisible, disabled, alwaysListenForScanner]);

  // Limpa timeout ao desmontar
  useEffect(() => {
    return () => {
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = useCallback((eanValue: string) => {
    const trimmed = eanValue.trim();
    if (!trimmed) return;

    // Limpa qualquer timeout pendente
    if (autoSubmitTimeoutRef.current) {
      clearTimeout(autoSubmitTimeoutRef.current);
      autoSubmitTimeoutRef.current = null;
    }

    // Verifica código secreto de reset
    if (trimmed === RESET_CODE) {
      console.log("[EanInput] Código de reset detectado");
      setShowResetConfirm(true);
      setValue("");
      bufferRef.current = "";
      return;
    }

    // Validações básicas
    if (!/^\d+$/.test(trimmed)) {
      console.log("[EanInput] EAN inválido (não numérico):", trimmed);
      return;
    }

    if (trimmed.length < MIN_EAN_LENGTH || trimmed.length > MAX_EAN_LENGTH) {
      console.log("[EanInput] EAN com tamanho inválido:", trimmed.length);
      return;
    }

    console.log("[EanInput] EAN válido, submetendo:", trimmed);
    onSubmit(trimmed);
    setValue("");
    bufferRef.current = "";
    setShowManualInput(false);
    isScannerInputRef.current = false;
  }, [onSubmit]);

  // Handler otimizado para WebViews - usa beforeinput/input events
  const handleInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const newValue = input.value;
    const now = Date.now();
    const timeSinceLastKey = now - lastKeyTimeRef.current;
    
    // Detecta se é scanner (caracteres muito rápidos)
    if (timeSinceLastKey < SCANNER_CHAR_THRESHOLD && newValue.length > 1) {
      isScannerInputRef.current = true;
    }
    
    lastKeyTimeRef.current = now;
    bufferRef.current = newValue;
    setValue(newValue);

    // Verifica código de reset
    if (newValue === RESET_CODE) {
      handleSubmit(newValue);
      return;
    }

    // Limpa timeout anterior
    if (autoSubmitTimeoutRef.current) {
      clearTimeout(autoSubmitTimeoutRef.current);
    }

    // Para scanners ou códigos válidos, auto-submete rapidamente
    if (/^\d+$/.test(newValue) && newValue.length >= MIN_EAN_LENGTH && newValue.length <= MAX_EAN_LENGTH) {
      // Auto-submit mais rápido para scanner, um pouco mais lento para digitação manual
      const delay = isScannerInputRef.current ? AUTO_SUBMIT_DELAY : 150;
      
      autoSubmitTimeoutRef.current = setTimeout(() => {
        // Verifica se o valor não mudou
        if (bufferRef.current === newValue) {
          console.log("[EanInput] Auto-submit após", delay, "ms");
          handleSubmit(newValue);
        }
      }, delay);
    }
  }, [handleSubmit]);

  // Handler para teclas - backup para Enter
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Captura Enter, keyCode 13, ou qualquer variação
    if (e.key === "Enter" || e.keyCode === 13 || e.which === 13) {
      e.preventDefault();
      e.stopPropagation();
      
      // Limpa timeout de auto-submit
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current);
        autoSubmitTimeoutRef.current = null;
      }
      
      console.log("[EanInput] Enter detectado, valor:", value);
      if (value.trim()) {
        handleSubmit(value);
      }
      return;
    }
    
    if (e.key === "Escape") {
      setValue("");
      bufferRef.current = "";
      setShowManualInput(false);
    }
  }, [value, handleSubmit]);

  // Handler específico para eventos nativos (WebView)
  useEffect(() => {
    const input = hiddenInputRef.current;
    if (!input) return;

    const handleNativeKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.keyCode === 13 || e.which === 13) {
        e.preventDefault();
        e.stopPropagation();
        
        if (autoSubmitTimeoutRef.current) {
          clearTimeout(autoSubmitTimeoutRef.current);
          autoSubmitTimeoutRef.current = null;
        }
        
        const currentValue = input.value.trim();
        console.log("[EanInput] Native Enter, valor:", currentValue);
        if (currentValue) {
          handleSubmit(currentValue);
        }
      }
    };

    // Adiciona listener nativo com capture para pegar antes do React
    input.addEventListener('keydown', handleNativeKeyDown, { capture: true });
    input.addEventListener('keypress', handleNativeKeyDown, { capture: true });
    
    return () => {
      input.removeEventListener('keydown', handleNativeKeyDown, { capture: true });
      input.removeEventListener('keypress', handleNativeKeyDown, { capture: true });
    };
  }, [handleSubmit]);

  useEffect(() => {
    if (!isNative) return;
    const shouldListen = (isVisible || alwaysListenForScanner) && !disabled;
    if (!shouldListen) return;

    const handleScannerKeyDown = (e: KeyboardEvent) => {
      if (showResetConfirm) return;

      if (e.key === "Enter" || e.keyCode === 13 || e.which === 13) {
        e.preventDefault();
        e.stopPropagation();

        if (autoSubmitTimeoutRef.current) {
          clearTimeout(autoSubmitTimeoutRef.current);
          autoSubmitTimeoutRef.current = null;
        }

        const currentValue = bufferRef.current.trim() || value.trim();
        if (currentValue) {
          handleSubmit(currentValue);
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        bufferRef.current = "";
        setValue("");
        setShowManualInput(false);
        return;
      }

      if (!/^\d$/.test(e.key)) {
        return;
      }

      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;

      if (timeSinceLastKey < SCANNER_CHAR_THRESHOLD && bufferRef.current.length > 0) {
        isScannerInputRef.current = true;
      }

      lastKeyTimeRef.current = now;

      const newValue = (bufferRef.current + e.key).replace(/\D/g, "");
      bufferRef.current = newValue;
      setValue(newValue);

      if (newValue === RESET_CODE) {
        handleSubmit(newValue);
        return;
      }

      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current);
      }

      if (/^\d+$/.test(newValue) && VALID_EAN_LENGTHS.includes(newValue.length)) {
        const delay = isScannerInputRef.current ? AUTO_SUBMIT_DELAY : 150;

        autoSubmitTimeoutRef.current = setTimeout(() => {
          if (bufferRef.current === newValue) {
            handleSubmit(newValue);
          }
        }, delay);
      }
    };

    window.addEventListener("keydown", handleScannerKeyDown, { capture: true });

    return () => {
      window.removeEventListener("keydown", handleScannerKeyDown, { capture: true });
    };
  }, [isNative, isVisible, alwaysListenForScanner, disabled, handleSubmit, showResetConfirm, value]);

  const handleFocus = () => {
    onFocus?.();
  };

  const handleConfirmReset = () => {
    console.log("[EanInput] Reset confirmado");
    setShowResetConfirm(false);
    onReset?.();
  };

  const handleCancelReset = () => {
    setShowResetConfirm(false);
    hiddenInputRef.current?.focus();
  };

  const handleVirtualKeyPress = useCallback((digit: string) => {
    setValue((prev) => {
      const next = (prev + digit).replace(/\D/g, "").slice(0, 14);
      bufferRef.current = next;
      return next;
    });
  }, []);

  const handleVirtualBackspace = useCallback(() => {
    setValue((prev) => {
      const next = prev.slice(0, -1);
      bufferRef.current = next;
      return next;
    });
  }, []);

  // Só retorna null se não estivermos ouvindo por scanner
  if (!isVisible && !alwaysListenForScanner) return null;

  const showUI = isVisible;

  return (
    <>
      {/* Input invisível para leitor de código de barras - otimizado para WebView */}
      <input
        ref={hiddenInputRef}
        type="text"
        inputMode="none"
        pattern="[0-9]*"
        value={value}
        onInput={handleInput}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onKeyPress={(e) => {
          if (e.key === "Enter" || e.charCode === 13) {
            e.preventDefault();
            if (value.trim()) handleSubmit(value);
          }
        }}
        onFocus={handleFocus}
        disabled={disabled || showResetConfirm}
        className="absolute opacity-0 pointer-events-auto"
        style={{ 
          position: 'absolute',
          left: '-9999px',
          width: '1px',
          height: '1px',
          fontSize: '16px',
          // @ts-ignore - propriedade experimental para suprimir teclado virtual
          virtualKeyboardPolicy: 'manual',
        }}
        aria-label="Scanner de código de barras"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        readOnly
      />

      {/* Modal de confirmação de reset */}
      {showUI && showResetConfirm && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-8 max-w-md text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
              <RotateCcw className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Resetar Dispositivo?</h2>
            <p className="text-muted-foreground mb-6">
              Isso apagará todos os dados locais do aplicativo, incluindo cache de mídias e configurações.
              O dispositivo precisará ser reconfigurado.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleCancelReset}
                className="px-6 py-3 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-6 py-3 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
              >
                Confirmar Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Indicador de scanner ativo */}
      {showUI && (
        <div
          className={cn(
            "absolute bottom-6 left-1/2 -translate-x-1/2 transition-all duration-300",
            showManualInput || showResetConfirm ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
        >
          <button
            onClick={() => setShowManualInput(true)}
            className="flex items-center gap-3 px-6 py-3 bg-black/60 backdrop-blur-sm rounded-full text-white/80 hover:text-white hover:bg-black/70 transition-colors"
          >
            <Barcode className="w-5 h-5 animate-pulse" />
          </button>
        </div>
      )}

      {/* Input manual visível */}
      {showUI && showManualInput && !showResetConfirm && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 bg-black/80 backdrop-blur-sm rounded-xl p-2 shadow-2xl">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
              <input
                ref={inputRef}
                type="text"
                inputMode="none"
                pattern="[0-9]*"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
                onKeyDown={handleKeyDown}
                placeholder="Digite o EAN"
                className="w-64 pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-primary"
                maxLength={14}
                enterKeyHint="go"
                readOnly
              />
            </div>
            
            <button
              onClick={() => handleSubmit(value)}
              disabled={!value.trim()}
              className="p-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => {
                setValue("");
                bufferRef.current = "";
                setShowManualInput(false);
                hiddenInputRef.current?.focus();
              }}
              className="p-3 bg-white/10 text-white/60 rounded-lg hover:bg-white/20 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {["1","2","3","4","5","6","7","8","9","0"].map((digit) => (
              <button
                key={digit}
                onClick={() => handleVirtualKeyPress(digit)}
                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors text-lg font-medium"
              >
                {digit}
              </button>
            ))}
            <button
              onClick={handleVirtualBackspace}
              className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors col-span-3 text-sm"
            >
              Apagar
            </button>
          </div>
        </div>
      )}
    </>
  );
};
