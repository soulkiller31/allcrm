// PM2 config — tuned for 1 CPU / 4GB RAM VPS
// Chrome (WhatsApp + PDF) uses ~400-600MB, Node uses ~150MB
// Total budget: Node 150MB + Chrome 600MB + OS 400MB = ~1.15GB of 4GB ✅

module.exports = {
  apps: [
    {
      name: 'salon-crm',
      script: 'src/server.js',
      cwd: '/var/www/salon-crm/backend',

      // Single instance — 1 CPU core, no benefit from clustering
      instances: 1,
      exec_mode: 'fork',

      // Node.js memory limits for 1-core VPS
      node_args: '--max-old-space-size=512',

      env: {
        NODE_ENV: 'production',
      },

      // Restart if Node process alone exceeds 600MB
      // (Chrome runs as separate processes, not counted here)
      max_memory_restart: '600M',

      // Logs
      error_file: '/var/log/salon-crm/error.log',
      out_file: '/var/log/salon-crm/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      // Restart behavior — wait 10s before restart to let Chrome clean up
      restart_delay: 10000,
      max_restarts: 10,
      min_uptime: '10s',

      // Watch — disabled in production
      watch: false,
    },
  ],
};
