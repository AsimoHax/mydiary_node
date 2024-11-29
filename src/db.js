const mysql = require('mysql2');
require('dotenv').config();
const password=process.env.MYSQL_PASSWORD;

// Create a connection to the database
const connection = mysql.createConnection({
    host: 'localhost', // Database host (use your MySQL server host or IP)
    user: 'root',      // Your MySQL username
    password: password, // Your MySQL password
    database: 'mydiary'  // The database you're connecting to
});

// Connect to the MySQL server
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the MySQL database:', err.stack);
        return;
    }
    console.log('Connected to the MySQL database as ID ' + connection.threadId);
});

module.exports = connection;
