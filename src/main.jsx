import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@fontsource-variable/cairo';
import './styles/index.css';
import App from './App';
import { CartProvider } from './context/CartContext';
import { MenuProvider } from './context/MenuContext';

// Register service worker for installable PWA and Web Push
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('ServiceWorker registration error:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <MenuProvider><CartProvider><App /></CartProvider></MenuProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
