import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import admin from 'firebase-admin';

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const auth = admin.auth();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log('Starting server...');
  const app = express();
  app.use(express.json()); // Add support for JSON bodies
  const PORT = 3000;

  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // API to sync Auth from admin dashboard
  app.post('/api/sync-auth', async (req, res) => {
    const { uid, email, password, adminToken } = req.body;

    if (!uid || !email || !password || !adminToken) {
      return res.status(400).json({ error: 'Parâmetros ausentes' });
    }

    try {
      // Verify admin token
      await auth.verifyIdToken(adminToken);

      console.log(`Syncing Auth for UID: ${uid} to Email: ${email}`);
      await auth.updateUser(uid, {
        email: email,
        password: password,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error syncing Auth:', error);
      let message = 'Erro ao sincronizar dados de acesso';
      if (error.code === 'auth/email-already-in-use') message = 'Este CPF já está sendo usado no sistema de login';
      res.status(500).json({ error: message, code: error.code });
    }
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
