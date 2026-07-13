module.exports = {
  apps: [
    {
      name: 'abyte-admin-api',
      script: './backend/server.js',
      cwd: '/var/www/AByte-POS/admin-panel',
      env_production: {
        NODE_ENV: 'production',
      },
      exec_mode: 'cluster',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      error_file: '/var/log/pm2/abyte-admin-error.log',
      out_file:   '/var/log/pm2/abyte-admin-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
