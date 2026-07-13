const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { readUsers, writeUsers, findUserByUsername } = require('../models/userModel');

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const cleanUsername = username.trim();
        if (cleanUsername.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters long' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        const users = readUsers();
        const userExists = users.some((user) => user.username.toLowerCase() === cleanUsername.toLowerCase());

        if (userExists) {
            return res.status(400).json({ error: 'Username is already taken' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        const newUser = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
            username: cleanUsername,
            password: hashedPassword,
            createdAt: Date.now()
        };

        users.push(newUser);
        writeUsers(users);

        const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { username: newUser.username }
        });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed. Server error.' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const user = findUserByUsername(username.trim());

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(400).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });

        res.json({
            message: 'Login successful',
            token,
            user: { username: user.username }
        });
    } catch (error) {
        res.status(500).json({ error: 'Login failed. Server error.' });
    }
});

router.get('/me', authenticateToken, (req, res) => {
    res.json({ user: { username: req.user.username } });
});

module.exports = router;
