import fs from 'fs';
import selfsigned from 'selfsigned';

/**
 * Creates a server certificate and caches it in the .cert directory
 */
export function generateTLSConfig() {
    fs.mkdirSync('.cert', {recursive: true});
  
    if (!fs.existsSync('.cert/server.key') || !fs.existsSync('.cert/server.cert')) {
      const attrs = [{name: 'commonName', value: 'dbp-dev.localhost'}];
      const pems = selfsigned.generate(attrs, {algorithm: 'sha256', days: 9999});
      fs.writeFileSync('.cert/server.key', pems.private);
      fs.writeFileSync('.cert/server.cert', pems.cert);
    }
  
    return {
      key: fs.readFileSync('.cert/server.key'),
      cert: fs.readFileSync('.cert/server.cert')
    }
  }