module.exports = {
  apps: [
    {
      name: 'xianlin-website',
      script: 'server.js',
      cwd: require('path').resolve(__dirname, '..'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 8080
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      time: true
    }
  ]
};
