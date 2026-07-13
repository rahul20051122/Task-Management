const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
// Running with JSON file-based storage.

const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const { ensureDataFiles } = require('./models/taskModel');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

ensureDataFiles();

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

app.use(express.static(path.join(__dirname)));

app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
