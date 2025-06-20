const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

let db;

async function initDatabase() {
  const sql = fs.readFileSync('dogwalks.sql', 'utf8');

  // Step 1: Connect without DB
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    multipleStatements: true
  });

  await connection.query('CREATE DATABASE IF NOT EXISTS DogWalkService');
  await connection.end();

  // Step 2: Connect to the DB
  db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'DogWalkService',
    namedPlaceholders: true,
    multipleStatements: true
  });

  // Step 3: Run schema SQL
  await db.query(sql);

  console.log('Database initialized successfully');

  await db.execute(`

    INSERT INTO Users (username, email, password_hash, role) VALUES

    ('alice123', 'alice@example.com', 'hashed123', 'owner'),

    ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),

    ('carol234', 'carol@example.com', 'hased789', 'owner'),

    ('unioadl', 'adl@adelaide.edu.au', 'hashedpassword', 'owner'),

    ('paulwalker', 'paulw@example.com', 'hashed34', 'walker');
  `)

await db.execute(`

    INSERT INTO Dogs(owner_id, name, size) VALUES

    ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Max', 'medium'),

    ((SELECT user_id FROM Users WHERE username = 'carol234'), 'Bella', 'small'),

    ((SELECT user_id FROM Users WHERE username = 'carol234'), 'Stella', 'small'),

    ((SELECT user_id FROM Users WHERE username = 'unioadl'), 'Rover', 'medium'),

    ((SELECT user_id FROM Users WHERE username = 'unioadl'), 'Daisy', 'large');
  `)

await db.execute(`

    INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status) VALUES

    ((SELECT dog_id FROM Dogs WHERE name = 'Max'), '2025-06-10 08:00:00', '30', 'Parklands', 'open'),

    ((SELECT dog_id FROM Dogs WHERE name = 'Bella'), '2025-06-10 09:30:00', '45', 'Beachside Ave', 'accepted'),

    ((SELECT dog_id FROM Dogs WHERE name = 'Stella'), '2025-06-10 10:00:00', '60', 'Glenelg', 'open'),

    ((SELECT dog_id FROM Dogs WHERE name = 'Rover'), '2025-06-10 10:45:00', '20', 'North Tce', 'accepted'),

    ((SELECT dog_id FROM Dogs WHERE name = 'Daisy'), '2025-06-10 11:00:00', '30', 'Frome Rd', 'cancelled');
  `)


await db.execute(`

  INSERT INTO WalkRatings (request_id, walker_id, owner_id, rating, comments) VALUES
  (
    1,
    2,
    (SELECT owner_id FROM Dogs WHERE dog_id = (SELECT dog_id FROM WalkRequests WHERE request_id = 1)),
    5,
    ''
  ),
  (
    2,
    2,
    (SELECT owner_id FROM Dogs WHERE dog_id = (SELECT dog_id FROM WalkRequests WHERE request_id = 2)),
    4,
    ''
  ),
  (
    3,
    5,
    (SELECT owner_id FROM Dogs WHERE dog_id = (SELECT dog_id FROM WalkRequests WHERE request_id = 3)),
    3.2,
    ''
  ),
  (
    4,
    5,
    (SELECT owner_id FROM Dogs WHERE dog_id = (SELECT dog_id FROM WalkRequests WHERE request_id = 4)),
    4,
    ''
  ),
  (
    5,
    2,
    (SELECT owner_id FROM Dogs WHERE dog_id = (SELECT dog_id FROM WalkRequests WHERE request_id = 5)),
    2,
    ''
  );
  `)
}


// API Route
app.get('/api/dogs', async (req, res) => {
  try {
    const [dogs] = await db.execute(`
      SELECT
      Dogs.name AS dog_name,
      Dogs.size AS size,
      Users.username AS owner_name
      FROM Dogs
      JOIN Users ON Dogs.owner_id = Users.user_id
      `);
    res.json(dogs);
  } catch (err) {
    console.error('Failed to fetch books:', err.message);
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [walkreq] = await db.execute(`
      SELECT 
      Dogs.name AS dog_name,
      WalkRequests.requested_time,
      WalkRequests.duration_minutes,
      WalkRequests.location,
      Users.username AS owner_username
      FROM WalkRequests
      JOIN Dogs ON WalkRequests.dog_id = Dogs.dog_id
      JOIN Users ON Dogs.owner_id = Users.user_id
      WHERE WalkRequests.status = "open";
      `);
    res.json(walkreq);
  } catch (err) {
    console.error('Failed to fetch books:', err.message);
    res.status(500).json({ error: 'Failed to fetch walk requests' });
  }
});

app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [walkersum] = await db.execute(`
      SELECT 
      Users.username AS walker_username,
      COUNT(WalkRatings.rating) AS total_ratings,
      AVG(WalkRatings.rating) AS average_rating
      FROM Users
      JOIN WalkRatings ON Users.user_id = WalkRatings.walker_id
      WHERE Users.role = 'walker'
      GROUP BY Users.username;
      `)
      res.json(walkersum)
  } catch (err) {
    console.error('Failed to fetch books:', err.message);
    res.status(500).json({ error: 'Failed to fetch walkers summary' });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// Start after DB is ready\
initDatabase()
  .then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Error setting up database. Ensure MySQL is running:', err.message);
    process.exit(1);
  });

module.exports = app;