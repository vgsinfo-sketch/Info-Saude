import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log('Main.tsx is starting...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Root element not found');
} else {
  try {
    console.log('Rendering App...');
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    console.log('App rendered successfully.');
  } catch (error) {
    console.error('Error rendering App:', error);
    rootElement.innerHTML = `<div style="padding: 20px; color: red;"><h1>Erro ao carregar o aplicativo</h1><pre>${error instanceof Error ? error.message : String(error)}</pre></div>`;
  }
}
