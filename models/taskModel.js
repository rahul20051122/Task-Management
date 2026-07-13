const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

function ensureDataFiles() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(TASKS_FILE)) {
        fs.writeFileSync(TASKS_FILE, JSON.stringify([], null, 2));
    }
}

function readTasks() {
    ensureDataFiles();

    try {
        return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
    } catch (error) {
        return [];
    }
}

function writeTasks(tasks) {
    ensureDataFiles();
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

function getUserTasks(userId) {
    return readTasks().filter((task) => task.userId === userId);
}

function createTask(task) {
    const tasks = readTasks();
    tasks.push(task);
    writeTasks(tasks);
    return task;
}

function updateTask(userId, taskId, updates) {
    const tasks = readTasks();
    const taskIndex = tasks.findIndex((task) => task.id === taskId && task.userId === userId);

    if (taskIndex === -1) {
        return null;
    }

    const filteredUpdates = {};
    Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
            filteredUpdates[key] = value;
        }
    });

    const updatedTask = {
        ...tasks[taskIndex],
        ...filteredUpdates
    };

    tasks[taskIndex] = updatedTask;
    writeTasks(tasks);
    return updatedTask;
}

function deleteTask(userId, taskId) {
    const tasks = readTasks();
    const taskIndex = tasks.findIndex((task) => task.id === taskId && task.userId === userId);

    if (taskIndex === -1) {
        return null;
    }

    const deletedTask = tasks.splice(taskIndex, 1)[0];
    writeTasks(tasks);
    return deletedTask;
}

module.exports = {
    ensureDataFiles,
    readTasks,
    writeTasks,
    getUserTasks,
    createTask,
    updateTask,
    deleteTask
};
