const fs   = require('fs');
const path = require('path');

const envVars = {};
try {
  fs.readFileSync(path.join(__dirname, 'backend/.env.production'), 'utf8')
    .split('\n')
    .forEach(line => {
      const m = line.match(/^([^#=][^=]*)=(.*)$/);
      if (m) envVars[m[1].trim()] = m[2].trim();
    });
} catch (_) {}

module.exports = {
  apps: [
    {
      name: 'abyte-admin-api',
      script: './backend/server.js',
      cwd: '/var/www/AByte-POS/admin-panel',
      exec_mode: 'cluster',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',

      env_production: {
        NODE_ENV:    'production',
        DB_HOST:     envVars.DB_HOST,
        DB_PORT:     envVars.DB_PORT,
        DB_USER:     envVars.DB_USER,
        DB_PASSWORD: envVars.DB_PASSWORD,
        MASTER_DB:   envVars.MASTER_DB || 'abyte_master',
        JWT_SECRET:  envVars.JWT_SECRET,
      },

      error_file: '/var/log/pm2/abyte-admin-error.log',
      out_file:   '/var/log/pm2/abyte-admin-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
