import { useState, useEffect, useCallback } from "react";
import { database, ref, onValue } from "@/lib/firebase";
import { differenceInMinutes, parseISO } from "date-fns";

export interface FirebaseDeviceData {
  atualizacao_plataforma: string;
  device_id: string;
  empresa_id: string;
  grupo_device: string;
  "last-update": string;
}

export interface FirebaseDevicesMap {
  [androidId: string]: FirebaseDeviceData;
}

export const useFirebaseDevices = () => {
  const [firebaseData, setFirebaseData] = useState<FirebaseDevicesMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const devicesRef = ref(database, "/"); // Assuming devices are at the root as per the user's example
    
    const unsubscribe = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setFirebaseData(data);
      } else {
        setFirebaseData({});
      }
      setLoading(false);
    }, (error) => {
      console.error("Firebase Realtime Database error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getDeviceStatus = useCallback((device: any) => {
    const firebaseInfo = Object.values(firebaseData || {}).find((f: any) => f.device_id === device.id);
    const lastUpdate = firebaseInfo?.["last-update"] || device.last_seen_at;

    if (!lastUpdate) return "offline";

    try {
      const lastSeenDate = typeof lastUpdate === 'string' ? parseISO(lastUpdate) : new Date(lastUpdate);
      const now = new Date();
      const diffInMinutes = differenceInMinutes(now, lastSeenDate);
      return diffInMinutes < 5 ? "online" : "offline";
    } catch (e) {
      console.error("Error parsing date in Firebase hook:", lastUpdate, e);
      return "offline";
    }
  }, [firebaseData]);

  return { firebaseData, loading, getDeviceStatus };
};
