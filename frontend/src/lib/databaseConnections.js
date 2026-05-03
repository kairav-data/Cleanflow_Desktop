export const DB_DEFAULTS = {
  mssql: { port: 1433, host: '', database: '', username: '', password: '', driver_mode: 'native', odbc_driver: '', dsn: '' },
  mysql: { port: 3306, host: '', database: '', username: '', password: '', driver_mode: 'native', odbc_driver: '', dsn: '' },
  postgresql: { port: 5432, host: '', database: '', username: '', password: '', driver_mode: 'native', odbc_driver: '', dsn: '' },
  oracle: { port: 1521, host: '', database: '', username: '', password: '', driver_mode: 'native', odbc_driver: '', dsn: '' },
  sqlite: { port: 0, host: 'localhost', database: '', username: '', password: '', driver_mode: 'native', odbc_driver: '', dsn: '' },
};

export const EMPTY_CONNECTION_FORM = {
  name: '',
  db_type: 'sqlite',
  host: 'localhost',
  port: 0,
  database: '',
  username: '',
  password: '',
  driver_mode: 'native',
  odbc_driver: '',
  dsn: '',
};

export function buildSampleQuery(dbType, tableName = 'your_table', limit = 1000) {
  const safeTable = String(tableName || 'your_table').trim() || 'your_table';
  const safeLimit = Number(limit) > 0 ? Number(limit) : 1000;

  switch (dbType) {
    case 'mssql':
      return `SELECT TOP ${safeLimit} * FROM ${safeTable}`;
    case 'oracle':
      return `SELECT * FROM ${safeTable} FETCH FIRST ${safeLimit} ROWS ONLY`;
    default:
      return `SELECT * FROM ${safeTable} LIMIT ${safeLimit}`;
  }
}
