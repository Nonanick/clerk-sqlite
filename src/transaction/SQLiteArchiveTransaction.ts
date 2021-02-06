import { AppException, ComparableValues } from 'clerk';
import { SQLiteArchive } from '../SQLiteArchive';

export class SQLiteArchiveTransaction {

  protected _ended: boolean = false;

  constructor(protected _conn: SQLiteArchive) {
  }

  protected async getConnection() {
    if (this._ended) {
      throw new AppException('Mysql Transaction already finished!');
    }

   return this._conn;
  }


  async execute(
    query: string,
    params: ComparableValues[] = []
  ) {
    if (this._ended) {
      throw new AppException('Mysql Transaction already finished!');
    }

    let poolConn = await this.getConnection();

    try {
      let ret = await poolConn.execute(query, params);
      return ret;
    } catch (err) {
      await this.rollback();
      throw err;
    }
  }

  async commit() {
    if (this._ended) {
      throw new AppException('Mysql Transaction already finished!');
    }
    this._ended = true;
    try {
      await this._conn!.execute("COMMIT");
    } catch (err) {
      await this._conn!.execute("ROLLBACK");
      throw err;
    } finally {
    }
  }

  async rollback() {
    if (this._ended) {
      throw new AppException('Mysql Transaction already finished!');
    }
    this._ended = true;

    try {
      await this._conn!.execute("ROLLBACK");
    } catch (err) {
      console.error('Failed to rollback mysql transaction! ', err);
    } 
  }

}