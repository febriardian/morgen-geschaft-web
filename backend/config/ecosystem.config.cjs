const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "morgen-backend",
      cwd: path.resolve(__dirname, ".."),
      script: "app.js",
      interpreter: "node",

      // Windows/local: satu proses (fork) lebih stabil dan cukup untuk port 3002.
      // Catatan: file ini hanya untuk menjalankan backend secara lokal via PM2.
      // Di shared hosting cPanel/Rumahweb, Passenger yang mengelola proses Node,
      // bukan konfigurasi cluster ini.
      instances: 1,
      exec_mode: "fork",

      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: "10s",

      env_file: ".env",
      env: {
        NODE_ENV: "production",
        PORT: 3002
      },

      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./storage/logs/pm2-error.log",
      out_file: "./storage/logs/pm2-out.log",
      merge_logs: true,

      kill_timeout: 20000,
      listen_timeout: 10000
    }
  ]
};
