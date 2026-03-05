import pool from './db';

export class Transaction {
  private connection: any;

  async begin() {
    this.connection = await pool.getConnection();
    await this.connection.beginTransaction();
    return this.connection;
  }

  async query(sql: string, params: any[] = []): Promise<any> {
    if (!this.connection) {
      throw new Error('Transaction not started. Call begin() first.');
    }
    const [rows] = await this.connection.execute(sql, params);
    return rows;
  }

  async commit() {
    if (!this.connection) return;
    await this.connection.commit();
    this.connection.release();
    this.connection = null;
  }

  async rollback() {
    if (!this.connection) return;
    await this.connection.rollback();
    this.connection.release();
    this.connection = null;
  }
}