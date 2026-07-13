const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getUserTasks, createTask, updateTask, deleteTask } = require('../models/taskModel');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
    res.json(getUserTasks(req.user.id));
});

router.post('/', authenticateToken, (req, res) => {
    const { title, desc, category, priority, dueDate, dueTime } = req.body;

    if (!title || !dueDate || !dueTime) {
        return res.status(400).json({ error: 'Title, dueDate, and dueTime are required' });
    }

    const newTask = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
        userId: req.user.id,
        title,
        desc: desc || '',
        category: category || 'others',
        priority: priority || 'medium',
        dueDate,
        dueTime,
        completed: false,
        createdAt: Date.now()
    };

    createTask(newTask);
    res.status(201).json(newTask);
});

router.put('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { title, desc, category, priority, dueDate, dueTime, completed } = req.body;

    const updatedTask = updateTask(req.user.id, id, {
        title: title !== undefined ? title : undefined,
        desc: desc !== undefined ? desc : undefined,
        category: category !== undefined ? category : undefined,
        priority: priority !== undefined ? priority : undefined,
        dueDate: dueDate !== undefined ? dueDate : undefined,
        dueTime: dueTime !== undefined ? dueTime : undefined,
        completed: completed !== undefined ? completed : undefined
    });

    if (!updatedTask) {
        return res.status(404).json({ error: 'Task not found or unauthorized' });
    }

    res.json(updatedTask);
});

router.delete('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const deletedTask = deleteTask(req.user.id, id);

    if (!deletedTask) {
        return res.status(404).json({ error: 'Task not found or unauthorized' });
    }

    res.json({ message: 'Task deleted successfully', task: deletedTask });
});

module.exports = router;
