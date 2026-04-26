require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MySQL Database configuration from .env
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // TiDB Serverless requires SSL connection
    ssl: {
        rejectUnauthorized: true
    }
};

// Create a connection pool (Recommended for Serverless/Vercel)
const db = mysql.createPool(dbConfig);

async function initializeDatabase() {
    try {
        // Create messages table if it doesn't exist
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        await db.query(createTableQuery);
        console.log('Table "messages" checked/created successfully.');
    } catch (error) {
        console.error('Error checking database table:', error.message);
    }
}

initializeDatabase();

// Endpoint to handle form submissions
app.post('/api/contact', async (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    if (!db) {
        return res.status(500).json({ error: 'Database connection not initialized. Check server logs.' });
    }

    try {
        const query = 'INSERT INTO messages (name, email, message) VALUES (?, ?, ?)';
        await db.query(query, [name, email, message]);
        
        res.status(201).json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
        console.error('Error saving message:', error);
        res.status(500).json({ error: 'Failed to save message.' });
    }
});

// Serve the index.html file
const path = require('path');

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve images and PDFs safely
app.get('/:file', (req, res, next) => {
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.pdf', '.html'];
    const ext = path.extname(req.params.file).toLowerCase();
    
    if (allowedExtensions.includes(ext)) {
        res.sendFile(path.join(__dirname, req.params.file));
    } else {
        next();
    }
});

// Vercel handles static files and port bindings automatically
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
        
        // Automatically open the browser
        const { exec } = require('child_process');
        const startCommand = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
        exec(`${startCommand} http://localhost:${port}`);
    });
}

// Export the app for Vercel
module.exports = app;
