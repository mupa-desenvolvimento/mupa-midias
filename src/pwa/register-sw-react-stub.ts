export interface RegisterSWOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
  onRegisteredSW?: (
    swUrl: string,
    registration: ServiceWorkerRegistration | undefined
  ) => void;
  onRegisterError?: (error: Error) => void;
}

export function useRegisterSW(_options?: RegisterSWOptions) {
  const tupleFalse = [false, () => {}] as const;

  return {
    needRefresh: tupleFalse,
    offlineReady: tupleFalse,
    updateServiceWorker: async (_reloadPage?: boolean) => {},
  };
}

