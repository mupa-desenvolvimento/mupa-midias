import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

if (!(Object as any).hasOwn) {
  ;(Object as any).hasOwn = (obj: any, key: PropertyKey) =>
    Object.prototype.hasOwnProperty.call(obj, key)
}

;(window as any).React = React

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
