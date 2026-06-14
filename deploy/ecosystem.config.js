module.exports = {
  apps: [
    {
      name: 'cheevo-api',
      script: 'dist/main.js',
      cwd: '/var/www/cheevo',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};