import { db } from "@/services/firebase";
import { ref, onValue, set, Unsubscribe } from "firebase/database";

export type PushCommand = 'reload' | 'reboot' | 'clear_cache' | 'screenshot' | 'identify';

class PushHandlerService {
  private static instance: PushHandlerService;
  private unsubscribe: Unsubscribe | null = null;
  private notificationCallback: ((msg: string) => void) | null = null;

  private constructor() {}

  static getInstance(): PushHandlerService {
    if (!PushHandlerService.instance) {
      PushHandlerService.instance = new PushHandlerService();
    }
    return PushHandlerService.instance;
  }

  init(deviceCode: string) {
    if (!deviceCode) return;
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    console.log(`[PushHandler] Initializing listener for device: ${deviceCode}`);
    const commandRef = ref(db, `/${deviceCode}/command`);
    
    this.unsubscribe = onValue(commandRef, (snapshot) => {
      const command = snapshot.val();
      if (command) {
        console.log("[PushHandler] Received command:", command);
        this.handleCommand(command, deviceCode);
        // Clear command after execution to avoid loops
        set(commandRef, null).catch(err => console.error("Error clearing command:", err));
      }
    });
  }

  onNotification(callback: (msg: string) => void) {
    this.notificationCallback = callback;
    return () => {
      this.notificationCallback = null;
    };
  }

  private handleCommand(command: string, deviceCode: string) {
    if (this.notificationCallback) {
      this.notificationCallback(`Comando recebido: ${command}`);
    }
    switch (command) {
      case 'reload':
      case 'reboot':
        console.log("[PushHandler] Executing Reload/Reboot...");
        window.location.reload();
        break;
      case 'clear_cache':
        console.log("[PushHandler] Clearing Cache...");
        localStorage.clear();
        // Preserving deviceCode might be important, but user asked for clear
        // We might want to preserve the 'device_code' or 'setup_completed' flag if stored
        // But for a hard reset, clearing everything is safer.
        // Assuming re-setup or re-linking might be needed if everything is cleared.
        // Better to just clear specific keys or Reload with cache clearing.
        // For now, let's clear application storage (IndexedDB should also be cleared ideally)
        window.location.reload();
        break;
      case 'identify': {
        // Flash screen or show ID
        const identifyEl = document.createElement('div');
        identifyEl.style.position = 'fixed';
        identifyEl.style.top = '0';
        identifyEl.style.left = '0';
        identifyEl.style.width = '100vw';
        identifyEl.style.height = '100vh';
        identifyEl.style.backgroundColor = 'blue';
        identifyEl.style.zIndex = '9999';
        identifyEl.style.display = 'flex';
        identifyEl.style.alignItems = 'center';
        identifyEl.style.justifyContent = 'center';
        identifyEl.style.color = 'white';
        identifyEl.style.fontSize = '5rem';
        identifyEl.innerText = deviceCode;
        document.body.appendChild(identifyEl);
        setTimeout(() => identifyEl.remove(), 5000);
        break;
      }
      default:
        console.warn("[PushHandler] Unknown command:", command);
    }
  }

  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

export const pushHandlerService = PushHandlerService.getInstance();
