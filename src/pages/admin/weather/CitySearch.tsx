
import { useState, useEffect } from "react";
import { useDebounce } from "../../../hooks/useDebounce";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface CitySearchProps {
  onSelect: (location: any) => void;
}

export function CitySearch({ onSelect }: CitySearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const debouncedQuery = useDebounce(query, 500);

  useEffect(() => {
    async function search() {
      if (!debouncedQuery || debouncedQuery.length < 3) {
        setResults([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        // Usar OpenStreetMap (Nominatim) diretamente do frontend
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(debouncedQuery)}&addressdetails=1&limit=5&countrycodes=br`
        );

        if (!response.ok) {
          throw new Error("Erro ao conectar com serviço de busca");
        }
        
        const data = await response.json();
        
        // Formatar resultados para o padrão esperado
        const formattedResults = data.map((item: any) => ({
          name: item.address.city || item.address.town || item.address.village || item.address.municipality || item.name,
          state: item.address.state,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          country: 'BR'
        })).filter((item: any) => item.name && item.state); // Filtrar resultados inválidos
        
        setResults(formattedResults);
      } catch (err: any) {
        console.error("Search error:", err);
        setError("Erro ao buscar cidades. Verifique sua conexão.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }

    search();
  }, [debouncedQuery]);

  const handleSelect = (city: any) => {
    onSelect({
      name: city.name,
      state: city.state,
      lat: city.lat,
      lon: city.lon,
      country: 'BR'
    });
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {query ? query : "Buscar cidade..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Digite cidade ou cidade, estado..." 
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading && (
              <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buscando...
              </div>
            )}
            {!loading && error && (
              <div className="py-6 text-center text-sm text-destructive px-4">
                {error}
              </div>
            )}
            {!loading && !error && results.length === 0 && debouncedQuery.length >= 3 && (
              <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
            )}
            {!loading && !error && results.length > 0 && (
              <CommandGroup heading="Sugestões">
                {results.map((city: any, idx: number) => (
                  <CommandItem
                    key={`${city.lat}-${city.lon}-${idx}`}
                    value={`${city.name}, ${city.state || ''}, ${city.country}`}
                    onSelect={() => handleSelect(city)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{city.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {city.state ? `${city.state}, ` : ''}{city.country}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
