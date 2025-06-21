const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const router = express.Router();
const mysql = require('mysql2/promise');
const session = require('express-session');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '/public')));

app.use(session({ //config session
    secret: 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
    }
}));

// Routes
const walkRoutes = require('./routes/walkRoutes');
const userRoutes = require('./routes/userRoutes');

app.use('/api/walks', walkRoutes);
app.use('/api/users', userRoutes);

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'DogWalkService'
});

router.post('/login', async (req, res) => {
    
    const { username, password } = req.body; //retrieve inputs form user

    try {
        const [rows] = await pool.query('SELECT * FROM Users WHERE username = ?', [username]); //finds user with provided username

    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    if (user.password_hash !== password) { //compares password prived to password stored. Not hashed so direct comparison used
        return res.status(401).json({ error: 'Invalid credentials' });
    }

        //save login info in session
    req.session.user = {
        id: user.user_id,
        username: user.username,
        role: user.role
    };

    res.json({ success: true, role: user.role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.clearCookie('connect.sid'); // or your session cookie name
        res.json({ success: true });
    });
});

// GET dogs for logged-in owner
app.get('/owner-dogs', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'owner') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const [rows] = await pool.query(
            'SELECT dog_id AS id, name FROM Dogs WHERE owner_id = ?',
            [req.session.user.id]
        );
        console.log(rows);
        console.log('Session user:', req.session.user);
        console.log('Owner id used in query:', req.session.user.id);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.use('/', router);


// Export the app instead of listening here
module.exports = app;