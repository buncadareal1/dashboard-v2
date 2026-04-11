module.exports = {
  apps: [
    {
      name: "hono-api",
      script: "dist/index.js",
      instances: 2, // 2 core Xeon Gold 6133
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      // Restart nếu memory > 1.5GB (giữ buffer cho Postgres + Redis trên 4GB RAM)
      max_memory_restart: "1536M",
      // Log
      error_file: "./logs/api-error.log",
      out_file: "./logs/api-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
