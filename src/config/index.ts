/**
 * Database Gateway Configuration
 */

import dotenv from 'dotenv';
dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
  },
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'kansha',
    poolMax: parseInt(process.env.MYSQL_POOL_MAX || '10', 10),
  },
  security: {
    apiKey: process.env.API_KEY || '',
  },
};

// Validate required config
if (!config.security.apiKey) {
  console.error('ERROR: API_KEY environment variable is required!');
  process.exit(1);
}
