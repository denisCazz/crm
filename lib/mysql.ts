/* eslint-disable @typescript-eslint/no-explicit-any */
import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getMysqlPool(): mysql.Pool {
  if (pool) return pool;

  const host = process.env.MYSQL_HOST;
  const port = process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : undefined;
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DB;

  if (!host || !port || !user || !database) {
    throw new Error('Missing MySQL env. Expected MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB');
  }

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    timezone: 'Z',
    decimalNumbers: true,
    namedPlaceholders: true,
  });

  return pool;
}

export async function dbQuery<T = any>(sql: string, params?: Record<string, any> | any[]): Promise<T[]> {
  const p = getMysqlPool();
  const [rows] = await p.query(sql, params as any);
  return rows as T[];
}

