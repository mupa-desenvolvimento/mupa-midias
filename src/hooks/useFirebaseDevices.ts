import { useState, useEffect } from "react";
import { database, ref, onValue } from "@/lib/firebase";

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

  return { firebaseData, loading };
};
