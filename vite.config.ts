import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { createRequire } from 'node:module';
const requireLocal = createRequire(path.resolve('package.json'));

function localApiBridgePlugin(): Plugin {
  const attach = (server: any) => {
    const { createApiBridge } = requireLocal('./electron/api-server.js');
    const bridge = createApiBridge();
    server.middlewares.use(bridge.handleApiRequest);
    server.httpServer?.once('close', () => bridge.close());
  };
  return { name:'local-api-bridge', configureServer:attach, configurePreviewServer:attach };
}
export default defineConfig({
  plugins:[react(),localApiBridgePlugin()],
  base:'./',
  resolve:{ alias:{ '@':path.resolve(__dirname,'src') } },
  build:{ outDir:'dist', emptyOutDir:true },
  server:{ host:'127.0.0.1',port:5173,strictPort:true,watch:{ignored:['**/release/**','**/dist/**','**/.audit/**','**/test-results/**']} },
  preview:{host:'127.0.0.1',port:4173,strictPort:true},
});
