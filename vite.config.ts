import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  server: {
    watch: {
      ignored: [
        '**/src/data/map_data.json',
        '**/src/data/guest_data.json',
        '**/src/data/log_data.json',
        '**/public/data/map_data.json',
        '**/public/data/guest_data.json',
        '**/public/data/log_data.json'
      ],
    },
  },
  plugins: [
    react(),
    {
      name: 'persistence-bridge',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';
          if (url.includes('/api/save-data') && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                
                // Modular Save Logic
                const targets = [
                  { name: 'map_data.json', content: data.mapConfig },
                  { name: 'guest_data.json', content: data.guests },
                  { name: 'log_data.json', content: data.logs }
                ];

                if (data.aiMapData) {
                  targets.push({ name: 'ai_map_data.json', content: data.aiMapData });
                }

                targets.forEach(target => {
                  try {
                    const srcPath = path.resolve(process.cwd(), 'src', 'data', target.name);
                    const publicPath = path.resolve(process.cwd(), 'public', 'data', target.name);
                    const jsonContent = JSON.stringify(target.content || [], null, 2);
                    
                    fs.writeFileSync(srcPath, jsonContent);
                    fs.writeFileSync(publicPath, jsonContent);
                  } catch (err) {
                    console.error(`BRIDGE ERROR (${target.name}):`, err);
                  }
                });

                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, timestamp: Date.now() }));
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: e.message }));
              }
            });
            return;
          }
          next();
        });
      }
    }
  ],
})
