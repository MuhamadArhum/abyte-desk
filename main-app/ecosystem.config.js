module.exports = {
  apps: [
    {
      name: 'abyte-main-api',
      script: './backend/server.js',
      cwd: '/var/www/AByte-POS/main-app',
      env_production: {
        NODE_ENV: 'production',
      },
      node_args: '--env-file=/var/www/AByte-POS/main-app/backend/.env.production',
      exec_mode: 'cluster',
      instances: 2,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: '/var/log/pm2/abyte-main-error.log',
      out_file:   '/var/log/pm2/abyte-main-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
