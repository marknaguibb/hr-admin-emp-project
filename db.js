const sql = require('mssql');

const sqlConfig = {
  user: 'sa',
  password: 'password',   // the password you just set
  server: 'MARKSLAPTOP',          // or 'localhost'
  database: 'University_HR_ManagementSystem',
  options: {
    encrypt: false,
    enableArithAbort: true,
    instanceName: 'SQLEXPRESS05'
  }
};



async function connectDB() {
    try {
        const pool = await sql.connect(sqlConfig);
        console.log('✅ Database connected!');
        return pool; // <-- THIS IS THE FIX
    } catch (err) {
        console.error('❌ DB Connection Error:', err);
        throw err;
    }
}


module.exports = { sql, connectDB };


