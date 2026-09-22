import mysql from 'mysql2/promise'

const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || '',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || '',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  connectTimeout: 60000,
  idleTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

let pool: mysql.Pool;

try {
  pool = mysql.createPool(dbConfig);
  
  // Verificar la conexión
  pool.getConnection()
    .then((connection) => {
      console.log(' Database connected successfully');
      connection.release();
    })
    .catch((error) => {
      console.error(' Database connection failed:', error);
    });
  
} catch (error) {
  console.error(' Failed to create database pool:', error);
  throw error;
}

// Verificar un array de filas
function isRowDataPacket(result: any): result is mysql.RowDataPacket[] {
  return Array.isArray(result) && result.length >= 0;
}

function isOkPacket(result: any): result is mysql.OkPacket {
  return result && typeof result === 'object' && 'affectedRows' in result;
}

export async function query(sql: string, params: any[] = []) {
  const startTime = Date.now();
  let connection;
  
  try {    
    connection = await pool.getConnection();
    const [rows] = await connection.execute(sql, params);
    const duration = Date.now() - startTime;
    
    if (duration > 1000) {
      console.log(` Slow query (${duration}ms):`, sql.substring(0, 100));
    }
    
    return rows;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(` Query error after ${duration}ms:`, error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

export async function querySimple(sql: string, params: any[] = []) {
  const startTime = Date.now();
  let connection;
  
  try {    
    connection = await pool.getConnection();
    const [rows] = await connection.query(sql, params);
    const duration = Date.now() - startTime;
    
    if (duration > 1000) {
      console.log(` Slow query (${duration}ms):`, sql.substring(0, 100));
    }
    
    return rows;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(` Query error after ${duration}ms:`, error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

export async function queryRows<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const result = await query(sql, params);
  return isRowDataPacket(result) ? result as T[] : [];
}

export async function queryExecute(sql: string, params: any[] = []): Promise<mysql.OkPacket> {
  const result = await query(sql, params);
  return result as mysql.OkPacket;
}

export async function closePool() {
  try {
    await pool.end();
    console.log(' Database pool closed');
  } catch (error) {
    console.error(' Error closing database pool:', error);
  }
}

export default pool;