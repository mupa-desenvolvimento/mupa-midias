import { supabase } from "@/integrations/supabase/client";
import { DeviceState } from "@/modules/shared/types";

export interface PlayLog {
  device_id: string;
  media_id: string;
  playlist_id: string;
  started_at: string;
  duration_watched: number;
  media_name?: string;
}

export interface PriceCheckLog {
  integration_id?: string;
  device_id: string;
  barcode: string;
  request_payload?: any;
  response_payload?: any;
  status_code?: number;
  response_time_ms?: number;
  error_message?: string;
  created_at?: string;
}

export class AnalyticsService {
  private logsQueue: PlayLog[] = [];
  private priceChecksQueue: PriceCheckLog[] = [];
  private isFlushing = false;
  private FLUSH_INTERVAL = 60 * 1000; // 1 minute
  private MAX_QUEUE_SIZE = 50;

  init() {
    this.loadQueue();
    setInterval(() => this.flushLogs(), this.FLUSH_INTERVAL);
  }

  logPlay(log: PlayLog) {
    this.logsQueue.push(log);
    if (this.logsQueue.length >= this.MAX_QUEUE_SIZE) {
      this.flushLogs();
    }
    this.saveQueue();
  }

  logPriceCheck(log: PriceCheckLog) {
    this.priceChecksQueue.push(log);
    this.saveQueue();
    // Try to flush immediately for price checks as they are user interactions
    if (navigator.onLine) {
      this.flushPriceChecks();
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem('analytics_queue', JSON.stringify(this.logsQueue));
      localStorage.setItem('price_checks_queue', JSON.stringify(this.priceChecksQueue));
    } catch (e) {
      console.error("[Analytics] Save queue failed:", e);
    }
  }

  private loadQueue() {
    try {
      const stored = localStorage.getItem('analytics_queue');
      if (stored) {
        this.logsQueue = JSON.parse(stored);
      }
      const storedChecks = localStorage.getItem('price_checks_queue');
      if (storedChecks) {
        this.priceChecksQueue = JSON.parse(storedChecks);
      }
    } catch (e) {
      console.error("[Analytics] Load queue failed:", e);
    }
  }

  private async flushLogs() {
    this.flushPlayLogs();
    this.flushPriceChecks();
  }

  private async flushPlayLogs() {
    if (this.logsQueue.length === 0 || this.isFlushing) return;
    
    // Only flush if online
    if (!navigator.onLine) return;

    this.isFlushing = true;
    const batch = [...this.logsQueue];
    
    try {
      const { error } = await supabase
        .from('play_logs' as any) 
        .insert(batch);

      if (error) throw error;

      // Remove flushed items
      this.logsQueue = this.logsQueue.filter(item => !batch.includes(item));
      this.saveQueue();
      console.log(`[Analytics] Flushed ${batch.length} play logs`);
    } catch (e) {
      console.error("[Analytics] Flush play logs failed:", e);
    } finally {
      this.isFlushing = false;
    }
  }

  private async flushPriceChecks() {
    if (this.priceChecksQueue.length === 0) return;
    if (!navigator.onLine) return;

    const batch = [...this.priceChecksQueue];
    
    try {
      // Assuming 'price_check_logs' table exists. If not, this will fail but queue persists.
      const { error } = await supabase
        .from('price_check_logs' as any) 
        .insert(batch);

      if (error) {
        // If table doesn't exist, maybe we should just log to console and clear queue to avoid infinite buildup
        if (error.code === '42P01') { // undefined_table
           console.warn("[Analytics] Table price_check_logs does not exist. Dropping logs.");
           this.priceChecksQueue = [];
           this.saveQueue();
           return;
        }
        throw error;
      }

      this.priceChecksQueue = this.priceChecksQueue.filter(item => !batch.includes(item));
      this.saveQueue();
      console.log(`[Analytics] Flushed ${batch.length} price checks`);
    } catch (e) {
      console.error("[Analytics] Flush price checks failed:", e);
    }
  }
}

export const analyticsService = new AnalyticsService();
