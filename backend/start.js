import app from './src/app.js';
import config from './src/config/index.js';
import fs from 'fs';

const log = (...args) => {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  fs.appendFileSync('./server-start.log', line);
  process.stdout.write(line);
};

const err = (...args) => {
  const line = `[${new Date().toISOString()}] ERROR: ${args.join(' ')}\n`;
  fs.appendFileSync('./server-start.log', line);
  process.stderr.write(line);
};

try {
  log('Starting server... Config loaded. Port:', config.port);
  log('Cashfree configured:', !!config.cashfree.appId, !!config.cashfree.secretKey, config.cashfree.env);
  log('Frontend URL:', config.frontendUrl);
  log('Backend URL:', config.backendUrl);

  const server = app.listen(config.port, () => {
    log(`Server LISTENING on port ${config.port} [${config.nodeEnv}]`);
    log('Health: http://localhost:' + config.port + '/api/health');
  });

  server.on('error', (e) => {
    err('Server error:', e.code, e.message);
    process.exit(1);
  });
} catch (e) {
  err('Startup exception:', e.message, e.stack);
  process.exit(1);
}
