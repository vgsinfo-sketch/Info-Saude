import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log('Starting server...');
  const app = express();
  const PORT = 3000;

  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    console.log('Initializing Vite middleware (DEVELOPMENT MODE)...');
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('Vite middleware initialized.');
    } catch (err) {
      console.error('Failed to initialize Vite middleware:', err);
      console.log('Falling back to static serving if dist exists...');
      process.env.NODE_ENV = 'production';
    }
  }

  if (process.env.NODE_ENV === 'production') {
    console.log('Running in PRODUCTION MODE...');
    const distPath = path.join(__dirname, 'dist');
    
    if (!fs.existsSync(distPath)) {
      console.error('CRITICAL ERROR: "dist" folder not found!');
      app.get('*', (req, res) => {
        res.status(500).send(`
          <div style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #e11d48;">Erro de Configuração</h1>
            <p>A pasta <strong>dist</strong> não foi encontrada no servidor.</p>
            <p><strong>Como resolver:</strong> Você precisa rodar <code>npm run build</code> e garantir que a pasta <code>dist</code> foi enviada para o servidor.</p>
          </div>
        `);
      });
    } else {
      console.log(`Serving static files from: ${distPath}`);
      app.use(express.static(distPath));
      
      app.get('*', (req, res) => {
        const isFileRequest = req.url.includes('.') && !req.url.endsWith('.html');
        if (isFileRequest) {
          res.status(404).send('Not found');
          return;
        }
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
