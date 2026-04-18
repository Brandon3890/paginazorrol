// lib/db.ts - CONFIGURACIÓN CORREGIDA CON SOPORTE PARA TRANSACCIONES
import mysql from 'mysql2/promise'

const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'tienda_juegos',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  connectTimeout: 60000,
  idleTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// Crear el pool con manejo de errores
let pool: mysql.Pool;

try {
  pool = mysql.createPool(dbConfig);
  
  // Verificar la conexión
  pool.getConnection()
    .then((connection) => {
      console.log('✅ Database connected successfully');
      connection.release();
    })
    .catch((error) => {
      console.error('❌ Database connection failed:', error);
    });
  
} catch (error) {
  console.error('❌ Failed to create database pool:', error);
  throw error;
}

// Función auxiliar para verificar si es un array de filas
function isRowDataPacket(result: any): result is mysql.RowDataPacket[] {
  return Array.isArray(result) && result.length >= 0;
}

// Función auxiliar para verificar si es OkPacket (INSERT, UPDATE, DELETE)
function isOkPacket(result: any): result is mysql.OkPacket {
  return result && typeof result === 'object' && 'affectedRows' in result;
}

// FUNCIÓN PRINCIPAL: Usa execute para consultas preparadas (seguro contra SQL injection)
export async function query(sql: string, params: any[] = []) {
  const startTime = Date.now();
  let connection;
  
  try {    
    connection = await pool.getConnection();
    const [rows] = await connection.execute(sql, params);
    const duration = Date.now() - startTime;
    
    if (duration > 1000) {
      console.log(`⚠️ Slow query (${duration}ms):`, sql.substring(0, 100));
    }
    
    return rows;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Query error after ${duration}ms:`, error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// NUEVA FUNCIÓN: Para comandos que no soporta execute (START TRANSACTION, COMMIT, etc.)
export async function querySimple(sql: string, params: any[] = []) {
  const startTime = Date.now();
  let connection;
  
  try {    
    connection = await pool.getConnection();
    // Usamos query() en lugar de execute() para comandos especiales
    const [rows] = await connection.query(sql, params);
    const duration = Date.now() - startTime;
    
    if (duration > 1000) {
      console.log(`⚠️ Slow query (${duration}ms):`, sql.substring(0, 100));
    }
    
    return rows;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Query error after ${duration}ms:`, error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// Función específica para SELECT que siempre devuelve array
export async function queryRows<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const result = await query(sql, params);
  return isRowDataPacket(result) ? result as T[] : [];
}

// Función específica para INSERT, UPDATE, DELETE
export async function queryExecute(sql: string, params: any[] = []): Promise<mysql.OkPacket> {
  const result = await query(sql, params);
  return result as mysql.OkPacket;
}

// Función para cerrar el pool (útil para scripts)
export async function closePool() {
  try {
    await pool.end();
    console.log('✅ Database pool closed');
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
  }
}

// Exportar el pool como default
export default pool;