
import { initializeApp } from "firebase/app";
// @ts-ignore - firebase modular API
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC1RGJg54rTlsha1xyqMQKHvg5B7RFIiWc",
  authDomain: "update-group-38a2b.firebaseapp.com",
  databaseURL: "https://update-group-38a2b-default-rtdb.firebaseio.com",
  projectId: "update-group-38a2b",
  storageBucket: "update-group-38a2b.firebasestorage.app",
  messagingSenderId: "1061722413506",
  appId: "1:1061722413506:web:9f7500a08423db97445e5b",
  measurementId: "G-BFZ1YK6K6D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
