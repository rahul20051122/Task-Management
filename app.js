document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let activeFilter = 'all'; // can be 'all', 'pending', 'completed', 'overdue' or any category
    let activeSort = 'dueDateAsc';
    let searchQuery = '';
    
    // For Undo operations
    let lastDeletedTask = null;
    let lastDeletedIndex = null;
    let toastTimeout = null;

    // --- DOM SELECTORS ---
    const greetingEl = document.getElementById('greeting');
    const currentDateEl = document.getElementById('current-date');
    const progressCircle = document.getElementById('progress-circle');
    const completionPercentage = document.getElementById('completion-percentage');
    const taskRatio = document.getElementById('task-ratio');
    
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const tasksContainer = document.getElementById('tasks-container');
    const emptyStateTemplate = document.getElementById('empty-state-template');
    
    // Modal Selectors
    const taskModal = document.getElementById('task-modal');
    const taskForm = document.getElementById('task-form');
    const modalTitle = document.getElementById('modal-title');
    const taskIdInput = document.getElementById('task-id');
    const taskTitleInput = document.getElementById('task-title-input');
    const taskDescInput = document.getElementById('task-desc-input');
    const taskCategoryInput = document.getElementById('task-category-input');
    const taskPriorityInput = document.getElementById('task-priority-input');
    const taskDateInput = document.getElementById('task-date-input');
    const taskTimeInput = document.getElementById('task-time-input');
    
    const addTaskTrigger = document.getElementById('add-task-trigger');
    const fabAddTask = document.getElementById('fab-add-task');
    const closeModalBtn = document.getElementById('close-modal');
    const cancelModalBtn = document.getElementById('cancel-modal');
    
    // Toast & Sidebar Selectors
    const toastContainer = document.getElementById('toast-container');
    const sidebar = document.getElementById('sidebar');

    // --- UTILITIES ---
    
    // HTML Sanitization to prevent XSS
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Generate random UUID-like unique IDs
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }

    // Set Greeting and Current Date
    function updateDateAndGreeting() {
        const now = new Date();
        
        // Greeting
        const hour = now.getHours();
        let greeting = 'Good evening';
        if (hour < 12) {
            greeting = 'Good morning';
        } else if (hour < 17) {
            greeting = 'Good afternoon';
        }
        greetingEl.textContent = `${greeting}, Achiever`;

        // Date format (e.g. Friday, June 12, 2026)
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        currentDateEl.textContent = now.toLocaleDateString('en-US', options);
    }

    // Parse task due datetime into a Date object
    function getTaskDueDate(task) {
        return new Date(`${task.dueDate}T${task.dueTime}`);
    }

    // Check if task is overdue
    function isTaskOverdue(task) {
        if (task.completed) return false;
        const now = new Date();
        const due = getTaskDueDate(task);
        return due < now;
    }

    // Save tasks to Local Storage
    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
        updateDashboard();
    }

    // --- TOAST NOTIFICATIONS ---
    function showToast(message, type = 'info', actionText = null, actionCallback = null) {
        // Clear any existing undo timeouts/toasts to prevent overlapping states
        if (toastTimeout) {
            clearTimeout(toastTimeout);
            toastTimeout = null;
        }

        // Close any current toasts
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        });

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconMarkup = '<i data-lucide="info"></i>';
        if (type === 'success') iconMarkup = '<i data-lucide="check-circle"></i>';
        if (type === 'warning') iconMarkup = '<i data-lucide="alert-triangle"></i>';
        if (type === 'danger') iconMarkup = '<i data-lucide="x-circle"></i>';

        toast.innerHTML = `
            <div class="toast-icon">${iconMarkup}</div>
            <div class="toast-message">${escapeHtml(message)}</div>
            ${actionText ? `<button class="toast-action" id="toast-action-btn">${actionText}</button>` : ''}
            <div class="toast-progress"></div>
        `;

        toastContainer.appendChild(toast);
        lucide.createIcons();

        if (actionText && actionCallback) {
            toast.querySelector('#toast-action-btn').addEventListener('click', () => {
                actionCallback();
                toast.classList.add('removing');
                setTimeout(() => toast.remove(), 300);
            });
        }

        // Auto remove toast after 5 seconds
        toastTimeout = setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => {
                toast.remove();
                // Permanent deletion hook (cleanup undo references)
                if (type === 'danger') {
                    lastDeletedTask = null;
                    lastDeletedIndex = null;
                }
            }, 300);
        }, 5000);
    }

    // --- DASHBOARD UPDATES ---
    function updateDashboard() {
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        
        // Update ratios
        taskRatio.textContent = `${completed}/${total}`;
        
        // Progress percentage calculation
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        completionPercentage.textContent = `${percent}%`;

        // Update Circular SVG Indicator (Circumference of r=15.915 is 100)
        progressCircle.style.strokeDashoffset = 100 - percent;

        // Update Sidebars numbers
        document.getElementById('count-all').textContent = total;
        document.getElementById('count-pending').textContent = tasks.filter(t => !t.completed).length;
        document.getElementById('count-completed').textContent = completed;
        document.getElementById('count-overdue').textContent = tasks.filter(isTaskOverdue).length;

        // Category sums
        const categories = ['work', 'personal', 'shopping', 'fitness', 'design', 'others'];
        categories.forEach(cat => {
            const count = tasks.filter(t => t.category === cat).length;
            document.getElementById(`count-${cat}`).textContent = count;
        });
    }

    // --- FORM & MODAL CONTROLS ---
    function openModal(editingTask = null) {
        taskModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Lock background scroll

        if (editingTask) {
            modalTitle.textContent = 'Edit Task';
            taskIdInput.value = editingTask.id;
            taskTitleInput.value = editingTask.title;
            taskDescInput.value = editingTask.desc;
            taskCategoryInput.value = editingTask.category;
            taskPriorityInput.value = editingTask.priority;
            taskDateInput.value = editingTask.dueDate;
            taskTimeInput.value = editingTask.dueTime;
        } else {
            modalTitle.textContent = 'Create New Task';
            taskForm.reset();
            taskIdInput.value = '';
            
            // Default date is today, default time is next hour
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            taskDateInput.value = `${year}-${month}-${day}`;
            
            const hours = String((today.getHours() + 1) % 24).padStart(2, '0');
            taskTimeInput.value = `${hours}:00`;
        }
        
        taskTitleInput.focus();
    }

    function closeModal() {
        taskModal.classList.remove('active');
        document.body.style.overflow = '';
        taskForm.reset();
    }

    // Submit Handler
    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const title = taskTitleInput.value.trim();
        const desc = taskDescInput.value.trim();
        const category = taskCategoryInput.value;
        const priority = taskPriorityInput.value;
        const dueDate = taskDateInput.value;
        const dueTime = taskTimeInput.value;
        const id = taskIdInput.value;

        if (!title || !dueDate || !dueTime) {
            showToast('Please fill out all required fields', 'warning');
            return;
        }

        if (id) {
            // Edit Mode
            const index = tasks.findIndex(t => t.id === id);
            if (index !== -1) {
                tasks[index] = {
                    ...tasks[index],
                    title,
                    desc,
                    category,
                    priority,
                    dueDate,
                    dueTime
                };
                showToast('Task updated successfully!', 'success');
            }
        } else {
            // New Task Mode
            const newTask = {
                id: generateId(),
                title,
                desc,
                category,
                priority,
                dueDate,
                dueTime,
                completed: false,
                createdAt: Date.now()
            };
            tasks.push(newTask);
            showToast('New task created!', 'success');
        }

        saveTasks();
        closeModal();
        renderTasks();
    });

    // --- CRUD OPERATIONS ---
    
    // Toggle completed status
    window.toggleTaskComplete = function(id) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            saveTasks();
            renderTasks();
            
            if (task.completed) {
                showToast('Task completed! Keep it up!', 'success');
            } else {
                showToast('Task marked active.', 'info');
            }
        }
    };

    // Trigger Edit Mode
    window.editTask = function(id) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            openModal(task);
        }
    };

    // Delete Task and save undo hook
    window.deleteTask = function(id) {
        const index = tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            const taskCard = document.querySelector(`[data-id="${id}"]`);
            if (taskCard) {
                taskCard.classList.add('deleting');
            }

            // Wait for collapse animation before removing from state
            setTimeout(() => {
                lastDeletedTask = tasks[index];
                lastDeletedIndex = index;
                
                // Remove task
                tasks.splice(index, 1);
                saveTasks();
                renderTasks();

                // Show undo toast
                showToast('Task deleted', 'danger', 'Undo', restoreDeletedTask);
            }, 300);
        }
    };

    // Restore task callback (Undo operation)
    function restoreDeletedTask() {
        if (lastDeletedTask !== null && lastDeletedIndex !== null) {
            tasks.splice(lastDeletedIndex, 0, lastDeletedTask);
            lastDeletedTask = null;
            lastDeletedIndex = null;
            saveTasks();
            renderTasks();
            showToast('Task restored!', 'success');
        }
    }

    // --- TIME BADGE GENERATION ---
    function generateTimeBadge(task) {
        if (task.completed) {
            return `
                <span class="time-badge">
                    <i data-lucide="check"></i> Completed
                </span>
            `;
        }

        const now = new Date();
        const due = getTaskDueDate(task);
        
        // Date formatting strings
        const dueFormatTime = due.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

        // Calculate differences in time
        const diffMs = due - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        
        const isToday = now.toDateString() === due.toDateString();
        
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const isTomorrow = tomorrow.toDateString() === due.toDateString();

        if (diffMs < 0) {
            // Overdue
            return `
                <span class="time-badge overdue">
                    <i data-lucide="alert-circle"></i> Overdue (${due.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})})
                </span>
            `;
        } else if (isToday) {
            return `
                <span class="time-badge today">
                    <i data-lucide="clock"></i> Today at ${dueFormatTime}
                </span>
            `;
        } else if (isTomorrow) {
            return `
                <span class="time-badge">
                    <i data-lucide="clock"></i> Tomorrow at ${dueFormatTime}
                </span>
            `;
        } else {
            const options = { month: 'short', day: 'numeric' };
            return `
                <span class="time-badge">
                    <i data-lucide="calendar"></i> ${due.toLocaleDateString('en-US', options)} at ${dueFormatTime}
                </span>
            `;
        }
    }

    // --- FILTERING & SORTING ENGINE ---
    function filterTasks() {
        return tasks.filter(task => {
            // 1. Text Search Filter
            const searchMatch = task.title.toLowerCase().includes(searchQuery) || 
                                task.desc.toLowerCase().includes(searchQuery);
            if (!searchMatch) return false;

            // 2. Status/Category Tag Filter
            if (activeFilter === 'all') return true;
            if (activeFilter === 'pending') return !task.completed;
            if (activeFilter === 'completed') return task.completed;
            if (activeFilter === 'overdue') return isTaskOverdue(task);
            
            // Standard category check
            return task.category === activeFilter;
        });
    }

    function sortTasks(filteredList) {
        return filteredList.sort((a, b) => {
            switch (activeSort) {
                case 'dueDateAsc':
                    return getTaskDueDate(a) - getTaskDueDate(b);
                case 'dueDateDesc':
                    return getTaskDueDate(b) - getTaskDueDate(a);
                case 'priorityDesc': {
                    const priorityWeight = { high: 3, medium: 2, low: 1 };
                    return priorityWeight[b.priority] - priorityWeight[a.priority];
                }
                case 'priorityAsc': {
                    const priorityWeight = { high: 3, medium: 2, low: 1 };
                    return priorityWeight[a.priority] - priorityWeight[b.priority];
                }
                case 'alphaAsc':
                    return a.title.localeCompare(b.title);
                case 'createdDesc':
                default:
                    return b.createdAt - a.createdAt;
            }
        });
    }

    // --- RENDER FUNCTION ---
    function renderTasks() {
        const filtered = filterTasks();
        const sorted = sortTasks(filtered);

        tasksContainer.innerHTML = '';

        if (sorted.length === 0) {
            const clone = emptyStateTemplate.content.cloneNode(true);
            tasksContainer.appendChild(clone);
            lucide.createIcons();
            return;
        }

        sorted.forEach(task => {
            const card = document.createElement('article');
            card.className = `task-card priority-${task.priority} ${task.completed ? 'completed' : ''}`;
            card.setAttribute('data-id', task.id);

            const categoryLabel = {
                work: '💼 Work',
                personal: '🏠 Personal',
                shopping: '🛒 Shopping',
                fitness: '🏃 Fitness',
                design: '🎨 Design',
                others: '✨ Others'
            }[task.category] || '✨ Others';

            card.innerHTML = `
                <label class="checkbox-container" aria-label="Mark task as complete">
                    <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTaskComplete('${task.id}')">
                    <span class="checkmark"></span>
                </label>
                
                <div class="task-info">
                    <h3 class="task-title">${escapeHtml(task.title)}</h3>
                    ${task.desc ? `<p class="task-desc">${escapeHtml(task.desc)}</p>` : ''}
                    <div class="task-meta">
                        <span class="badge badge-${task.category}">${categoryLabel}</span>
                        <span class="badge badge-${task.priority}">${task.priority} priority</span>
                        ${generateTimeBadge(task)}
                    </div>
                </div>

                <div class="task-actions">
                    <button class="action-btn edit-btn" onclick="editTask('${task.id}')" title="Edit task" aria-label="Edit task">
                        <i data-lucide="edit-3"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteTask('${task.id}')" title="Delete task" aria-label="Delete task">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;

            tasksContainer.appendChild(card);
        });

        // Initialize Lucide Icons for dynamically generated markup
        lucide.createIcons();
    }

    // --- EVENT LISTENERS ---

    // Open Add Task Modal
    addTaskTrigger.addEventListener('click', () => openModal());
    fabAddTask.addEventListener('click', () => openModal());

    // Close Modal Controls
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);
    
    // Close modal if user clicks backdrop
    taskModal.addEventListener('click', (e) => {
        if (e.target === taskModal) closeModal();
    });

    // Real-time search key-ups
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderTasks();
    });

    // Sort handler
    sortSelect.addEventListener('change', (e) => {
        activeSort = e.target.value;
        renderTasks();
    });

    // Sidebar filter clicks using event delegation
    sidebar.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;

        // Toggle Active Button state
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Set state filters
        if (btn.dataset.filter) {
            activeFilter = btn.dataset.filter;
        } else if (btn.dataset.category) {
            activeFilter = btn.dataset.category;
        }

        renderTasks();
    });

    // --- INITIALIZATION ---
    updateDateAndGreeting();
    updateDashboard();
    renderTasks();

    // Setup date/time greetings updates every minute
    setInterval(updateDateAndGreeting, 60000);
});
