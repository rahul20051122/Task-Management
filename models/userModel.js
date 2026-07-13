const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureDataFiles() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
    }
}

function readUsers() {
    ensureDataFiles();

    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (error) {
        return [];
    }
}

function writeUsers(users) {
    ensureDataFiles();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function findUserByUsername(username) {
    const users = readUsers();
    return users.find((user) => user.username.toLowerCase() === username.toLowerCase());
}

module.exports = {
    ensureDataFiles,
    readUsers,
    writeUsers,
    findUserByUsername
};
