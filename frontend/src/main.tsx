import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';

const container = document.getElementById('root');

if (container === null) {
  throw new Error('No se encontro el contenedor raiz de la aplicacion local');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
