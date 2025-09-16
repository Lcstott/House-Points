/*
 * House Points System (client‑side implementation)
 *
 * This script powers a simple house points management tool entirely on
 * the client side. All data persists in the browser's localStorage.
 * There are two user roles: admin and teacher. An admin can create
 * teachers, houses and students. Teachers can award or deduct points
 * from students in their school. Both roles can view a house
 * leaderboard and the transaction history.
 */

// Keys used in localStorage and sessionStorage
const STORAGE_KEY = 'housePointsData';
const SESSION_KEY = 'currentUser';

// Helper: returns ordinal suffix for a given integer (1 -> 'st', 2 -> 'nd', etc.)
function getOrdinalSuffix(n) {
    const j = n % 10;
    const k = n % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
}

// Initialize data if not present
function initData() {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) {
        const data = {
            users: [
                { username: 'admin', password: 'admin123', role: 'admin' }
            ],
            houses: [],
            students: [],
            transactions: [],
            rewards: [],
            nextHouseId: 1,
            nextStudentId: 1,
            nextTransactionId: 1,
            nextRewardId: 1
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
}

// Load application state
function loadData() { return ensureSchema(JSON.parse(localStorage.getItem(STORAGE_KEY))); }

// Save application state
// Ensure schema migrations (e.g., add accessibleStudentIds for teachers)
function ensureSchema(data) {
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data.users)) {
        data.users.forEach(u => {
            if (u && u.role === 'teacher' && !Array.isArray(u.accessibleStudentIds)) {
                u.accessibleStudentIds = [];
            }
            if (u && u.role === 'teacher' && !Array.isArray(u.gradeAccess)) {
                u.gradeAccess = [];
            }
        });
    }
    return data;
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Save current user in sessionStorage
function setCurrentUser(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

// Get current user from sessionStorage
function getCurrentUser() {
    const val = sessionStorage.getItem(SESSION_KEY);
    return val ? JSON.parse(val) : null;
}

// Clear current user
function clearCurrentUser() {
    sessionStorage.removeItem(SESSION_KEY);
}

// Attempt login with credentials
function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const data = loadData();
    const user = data.users.find(u => (u.username || '').toLowerCase() === (username || '').toLowerCase() && u.password === password);
    const alertBox = document.getElementById('loginAlert');
    if (user) {
        setCurrentUser(user);
        showMainPage();
        alertBox.classList.add('d-none');
    } else {
        alertBox.textContent = 'Invalid username or password';
        alertBox.classList.remove('d-none');
    }
}

// Logout user
function logout() {
    clearCurrentUser();
    location.reload();
}

// Render navigation tabs based on current user role
function renderNavTabs() {
    const navContainer = document.getElementById('navTabs');
    navContainer.innerHTML = '';
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    // Define available tabs for roles
    const tabs = [
        ,
    ];
    if (currentUser.role === 'admin') {
        tabs.push(
            { id: 'leaderboard', label: 'Leaderboard' },
            { id: 'houses', label: 'Houses' },
            { id: 'students', label: 'Students' },
            { id: 'teachers', label: 'Teachers' },
            { id: 'rewards', label: 'Rewards' },
            { id: 'sorting', label: 'Sorting Wheel' },
            { id: 'transactions', label: 'Transactions' }
        );
    } else {
        tabs.push(
            { id: 'award', label: 'Points' },
            { id: 'transactions', label: 'My Transactions' }
        );
    }
    tabs.forEach((tab, index) => {
        const btn = document.createElement('button');
        btn.textContent = tab.label;
        btn.onclick = () => showSection(tab.id);
        btn.dataset.section = tab.id;
        if (index === 0) btn.classList.add('active');
        navContainer.appendChild(btn);
    });
}

// Show a specific section and hide others
function showSection(sectionId) {
    // Set active tab
    const navButtons = document.querySelectorAll('.nav-tabs button');
    navButtons.forEach(btn => {
        if (btn.dataset.section === sectionId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = '';
    
    // Prevent teachers from accessing the leaderboard
    const _user = getCurrentUser();
    if (sectionId === 'leaderboard' && _user && _user.role !== 'admin') {
        sectionId = 'award';
        // Also make sure the matching tab looks active
        const navButtons = document.querySelectorAll('.nav-tabs button');
        navButtons.forEach(btn => { btn.classList.toggle('active', btn.dataset.section === 'award'); });
    }
    switch (sectionId) {
        case 'leaderboard':
            renderLeaderboard(contentArea);
            break;
        case 'award':
            renderAwardPoints(contentArea);
            break;
        case 'houses':
            renderManageHouses(contentArea);
            break;
        case 'students':
            renderManageStudents(contentArea);
            break;
        case 'teachers':
            renderManageTeachers(contentArea);
            break;
        case 'rewards':
            renderRewards(contentArea);
            break;
        case 'sorting':
            renderSortingWheel(contentArea);
            break;
        case 'transactions':
            renderTransactions(contentArea);
            break;
        default:
            break;
    }
}

// Render leaderboard
function renderLeaderboard(container) {
    const data = loadData();
    const houses = [...data.houses].sort((a, b) => b.points - a.points);
    // Clear previous content
    container.innerHTML = '';
    if (houses.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'No houses found. Admins can create houses.';
        container.appendChild(p);
        return;
    }
    // Ceremony button to animate results
    const btnCeremony = document.createElement('button');
    btnCeremony.textContent = 'Start Ceremony';
    btnCeremony.className = 'primary';
    btnCeremony.style.marginBottom = '1rem';
    btnCeremony.onclick = runCeremony;
    container.appendChild(btnCeremony);

    // Vertical leaderboard with rank next to logo
    const wrapper = document.createElement('div');
    wrapper.className = 'leaderboard-vertical';
    houses.forEach((house, idx) => {
        const row = document.createElement('div');
        row.className = 'leaderboard-row';
        // Rank element
        const rankDiv = document.createElement('div');
        rankDiv.className = 'rank';
        rankDiv.textContent = `${idx + 1}${getOrdinalSuffix(idx + 1)}`;
        row.appendChild(rankDiv);
        // Logo element
        const logoContainer = document.createElement('div');
        logoContainer.className = 'logo';
        if (house.logo) {
            const img = document.createElement('img');
            img.src = house.logo;
            img.alt = `${house.name} logo`;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            logoContainer.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'house-logo-placeholder';
            placeholder.textContent = house.name.charAt(0).toUpperCase();
            logoContainer.appendChild(placeholder);
        }
        row.appendChild(logoContainer);
        // Details element
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'details';
        const nameEl = document.createElement('h4');
        nameEl.textContent = house.name;
        const pointsEl = document.createElement('h3');
        pointsEl.textContent = `${house.points} pts`;
        pointsEl.style.fontSize = '2rem';
        pointsEl.style.color = '#facc15';
        pointsEl.style.margin = '0.25rem 0 0';
        detailsDiv.appendChild(nameEl);
        detailsDiv.appendChild(pointsEl);
        row.appendChild(detailsDiv);
        wrapper.appendChild(row);
    });
    container.appendChild(wrapper);
    // Top students and teachers section
    const topContainer = document.createElement('div');
    topContainer.style.marginTop = '2rem';
    topContainer.style.display = 'flex';
    topContainer.style.flexWrap = 'wrap';
    topContainer.style.gap = '2rem';
    // Top students
    const studentsCopy = [...data.students].sort((a, b) => b.points - a.points);
    const topStudents = studentsCopy.slice(0, 3);
    const studentSection = document.createElement('div');
    studentSection.style.flex = '1 1 250px';
    const stuTitle = document.createElement('h3');
    stuTitle.textContent = 'Top Students';
    studentSection.appendChild(stuTitle);
    const stuList = document.createElement('ol');
    topStudents.forEach(stu => {
        const li = document.createElement('li');
        const house = data.houses.find(h => h.id === stu.houseId);
        const colour = house ? (house.color || '#6c757d') : '#6c757d';
        li.innerHTML = `<span style="display:inline-block;width:0.8rem;height:0.8rem;border-radius:50%;background-color:${colour};margin-right:0.5rem"></span>${stu.name} — ${stu.points} pts`;
        stuList.appendChild(li);
    });
    if (topStudents.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No students yet';
        stuList.appendChild(li);
    }
    studentSection.appendChild(stuList);
    topContainer.appendChild(studentSection);
    // Top teachers
    const teachers = data.users.filter(u => u.role === 'teacher');
    const teacherTotals = teachers.map(t => {
        const total = data.transactions.reduce((sum, txn) => {
            if (txn.teacherUsername === t.username && txn.amount > 0) {
                return sum + txn.amount;
            }
            return sum;
        }, 0);
        return { username: t.username, total };
    });
    teacherTotals.sort((a, b) => b.total - a.total);
    const topTeachers = teacherTotals.slice(0, 3);
    const teacherSection = document.createElement('div');
    teacherSection.style.flex = '1 1 250px';
    const teachTitle = document.createElement('h3');
    teachTitle.textContent = 'Top Teachers';
    teacherSection.appendChild(teachTitle);
    const teachList = document.createElement('ol');
    topTeachers.forEach(t => {
        const li = document.createElement('li');
        li.textContent = `${t.username} — ${t.total} pts awarded`;
        teachList.appendChild(li);
    });
    if (topTeachers.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No teacher activity yet';
        teachList.appendChild(li);
    }
    teacherSection.appendChild(teachList);
    topContainer.appendChild(teacherSection);
    container.appendChild(topContainer);
}

// Render award points form
function renderAwardPoints(container) {
    const _user = getCurrentUser();
    function normalizeGrade(g) {
        if (!g) return '';
        const s = String(g).trim().toLowerCase();
        if (s === 'k' || s.startsWith('kind')) return 'K';
        const m = s.match(/(k|kindergarten|\d+)/);
        if (!m) return '';
        const val = m[1];
        if (val === 'k' || val === 'kindergarten') return 'K';
        return String(parseInt(val, 10));
    }

    const data = loadData();
    // Clear previous contents
    container.innerHTML = '';
    if (data.students.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'No students available. Admins must create houses and students first.';
        container.appendChild(p);
        return;
    }
    const form = document.createElement('form');
    form.onsubmit = event => {
        event.preventDefault();
        submitAwardForm(form);
    };
    // Student select
    const labelStudent = document.createElement('label');
    labelStudent.textContent = 'Student';
    form.appendChild(labelStudent);
    
    
    const currentUser = getCurrentUser();
    let studentList = data.students;

    // Student dropdown container
    const studentDropdownContainer = document.createElement('div');
    studentDropdownContainer.id = 'studentSelects';

    if (currentUser && currentUser.role === 'teacher') {
        const normalizeGrade = (g) => {
            if (g === undefined || g === null) return '';
            const s = String(g).trim().toLowerCase();
            if (s === 'k' || s.startsWith('kind')) return 'K';
            const m = s.match(/(k|kindergarten|\d+)/);
            if (!m) return '';
            const v = m[1];
            if (v === 'k' || v === 'kindergarten') return 'K';
            return String(parseInt(v, 10));
        };
        const access = Array.isArray(currentUser.gradeAccess) ? currentUser.gradeAccess.map(g => normalizeGrade(g)) : [];
        if (access.length > 1) {
            // Multiple grades → separate dropdown per grade
            access.forEach(gr => {
                const label = document.createElement('label');
                label.textContent = 'Grade ' + gr;
                const sel = document.createElement('select');
                sel.required = false;
                const ph = document.createElement('option'); ph.value=''; ph.textContent='-- Select student --'; sel.appendChild(ph);
                const options = data.students.filter(stu => normalizeGrade(stu.grade) === gr);
                options.forEach(stu => {
                    const opt = document.createElement('option');
                    opt.value = stu.id;
                    const house = data.houses.find(h => h.id === stu.houseId);
                    opt.textContent = stu.name + (house ? ' (' + house.name + ')' : '');
                    sel.appendChild(opt);
                });
                studentDropdownContainer.appendChild(label);
                studentDropdownContainer.appendChild(sel);
            });
        } else {
            // Single grade dropdown
            const label = document.createElement('label');
            label.textContent = 'Grade ' + access[0];
            const sel = document.createElement('select');
            sel.required = true;
            const ph = document.createElement('option'); ph.value=''; ph.textContent='-- Select student --'; sel.appendChild(ph);
            const options = data.students.filter(stu => access.includes(normalizeGrade(stu.grade)));
            options.forEach(stu => {
                const opt = document.createElement('option');
                opt.value = stu.id;
                const house = data.houses.find(h => h.id === stu.houseId);
                opt.textContent = stu.name + (house ? ' (' + house.name + ')' : '');
                sel.appendChild(opt);
            });
            studentDropdownContainer.appendChild(label);
            studentDropdownContainer.appendChild(sel);
        }
    } else {
        // Admin – single dropdown with all students
        const sel = document.createElement('select');
        sel.required = true;
        data.students.forEach(stu => {
            const opt = document.createElement('option');
            opt.value = stu.id;
            const house = data.houses.find(h => h.id === stu.houseId);
            opt.textContent = stu.name + (house ? ' (' + house.name + ')' : '');
            sel.appendChild(opt);
        });
        studentDropdownContainer.appendChild(label);
        studentDropdownContainer.appendChild(sel);
    }
    form.appendChild(studentDropdownContainer);
// Amount input
    const labelAmt = document.createElement('label');
    labelAmt.textContent = 'Points';
    form.appendChild(labelAmt);
    const inputAmt = document.createElement('input');
    inputAmt.type = 'number';
    inputAmt.required = true;
    form.appendChild(inputAmt);
    // Note
    const labelNote = document.createElement('label');
    labelNote.textContent = 'Reason (required)';
    form.appendChild(labelNote);
    const textareaNote = document.createElement('textarea');
    textareaNote.rows = 3;
    // Make reason mandatory
    textareaNote.required = true;
    textareaNote.placeholder = 'Reason (required)';
    // Add explicit action buttons
    const controlsRow = document.createElement('div');
    controlsRow.style.display = 'flex';
    controlsRow.style.gap = '0.75rem';
    controlsRow.style.marginTop = '0.75rem';
    const btnAdd = document.createElement('button');
    btnAdd.type = 'button';
    btnAdd.className = 'success';
    btnAdd.textContent = 'Add Points';
    btnAdd.onclick = () => { form.dataset.mode = 'add'; form.requestSubmit(); };
    const btnTake = document.createElement('button');
    btnTake.type = 'button';
    btnTake.className = 'danger';
    btnTake.textContent = 'Take Points';
    btnTake.onclick = () => { form.dataset.mode = 'take'; form.requestSubmit(); };
    controlsRow.appendChild(btnAdd);
    controlsRow.appendChild(btnTake);
    form.appendChild(controlsRow);

    form.appendChild(textareaNote);
    // Submit
    const btnSubmit = document.createElement('button');
    btnSubmit.type = 'submit';
    btnSubmit.style.display = 'none';
    form.appendChild(btnSubmit);
    // Alert area
    const alert = document.createElement('div');
    alert.id = 'awardAlert';
    alert.className = 'alert d-none';
    form.appendChild(alert);
    container.appendChild(form);

    }

// Handle awarding/deducting points
function submitAwardForm(form) {
    const selects = Array.from(form.querySelectorAll('#studentSelects select'));
    const amountInput = form.querySelector('input[type="number"]');
    const noteInput = form.querySelector('textarea');
    let studentId = NaN;
    if (selects.length > 0) {
        for (const s of selects) { if (s.value) { studentId = parseInt(s.value); break; } }
    } else {
        const single = form.querySelector('select');
        if (single) studentId = parseInt(single.value);
    }
    let amount = parseInt(amountInput.value);
    const note = noteInput.value.trim();
    const mode = form.dataset.mode || 'add';
    if (!studentId || isNaN(amount)) {
        const alert = form.querySelector('#awardAlert') || (function(){
            const a = document.createElement('div'); a.id='awardAlert'; a.className='alert d-none'; form.appendChild(a); return a;
        })();
        alert.className = 'alert alert-danger';
        alert.textContent = 'Please select a student and enter a points value.';
        alert.classList.remove('d-none');
        return;
    }
    if (!note) {
        const alert = form.querySelector('#awardAlert') || (function(){
            const a = document.createElement('div'); a.id='awardAlert'; a.className='alert d-none'; form.appendChild(a); return a;
        })();
        alert.className = 'alert alert-danger';
        alert.textContent = 'A reason is required.';
        alert.classList.remove('d-none');
        return;
    }
    if (mode === 'take' && amount > 0) amount = -amount;
    const data = loadData();
    const student = data.students.find(s => s.id === studentId);
    const house = data.houses.find(h => h.id === student.houseId);
    student.points += amount;
    if (house) {
        house.points += amount;
    }
    const currentUser = getCurrentUser();
    const txn = {
        id: data.nextTransactionId++,
        timestamp: new Date().toISOString(),
        teacherUsername: currentUser.username,
        studentId: student.id,
        houseId: house ? house.id : null,
        amount: amount,
        note: note
    };
    data.transactions.push(txn);
    saveData(data);
    // Display success message
    const alert = form.querySelector('#awardAlert');
    alert.className = 'alert alert-success';
    const action = amount >= 0 ? 'added' : 'taken';
    alert.textContent = `Successfully ${action} ${Math.abs(amount)} point(s) for ${student.name}.`;
    alert.classList.remove('d-none');
    // Reset form
    amountInput.value = '';
    noteInput.value = '';
    // Refresh leaderboard and transactions if visible
    showSection('leaderboard');
}

// Render manage houses page
function renderManageHouses(container) {
    const data = loadData();
    // Clear previous contents
    container.innerHTML = '';
    // Form to add house
    const form = document.createElement('form');
    form.onsubmit = event => {
        event.preventDefault();
        const name = form.querySelector('input[name="houseName"]').value.trim();
        const color = form.querySelector('input[name="houseColor"]').value.trim();
        if (!name) return;
        // check duplicate name
        if (data.houses.find(h => h.name.toLowerCase() === name.toLowerCase())) {
            alert('House name already exists');
            return;
        }
        const fileInput = form.querySelector('input[name="houseLogo"]');
        const file = fileInput && fileInput.files ? fileInput.files[0] : null;
        // function to create house after reading logo
        const createHouse = (logoData) => {
            const house = {
                id: data.nextHouseId++,
                name: name,
                color: color || null,
                points: 0,
                logo: logoData || null
            };
            data.houses.push(house);
            saveData(data);
            form.reset();
            renderManageHouses(container);
        };
        if (file) {
            const reader = new FileReader();
            reader.onload = e => {
                createHouse(e.target.result);
            };
            reader.readAsDataURL(file);
        } else {
            createHouse(null);
        }
    };
    form.innerHTML = `
        <h3>Add House</h3>
        <label>House Name</label>
        <input type="text" name="houseName" required>
        <label>Color (optional)</label>
        <input type="text" name="houseColor" placeholder="#007bff or red">
        <label>Logo (optional)</label>
        <input type="file" name="houseLogo" accept="image/*">
        <button type="submit" class="success">Add House</button>
    `;
    container.appendChild(form);
    // List existing houses
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Logo</th><th>Name</th><th>Color</th><th>Points</th><th>Actions</th></tr></thead>';
    const tbody = document.createElement('tbody');
    data.houses.forEach(house => {
        const tr = document.createElement('tr');
        // Logo cell with clickable upload
        const logoTd = document.createElement('td');
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        fileInput.onchange = () => {
            const file = fileInput.files && fileInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = e => {
                    house.logo = e.target.result;
                    saveData(data);
                    renderManageHouses(container);
                };
                reader.readAsDataURL(file);
            }
        };
        if (house.logo) {
            const img = document.createElement('img');
            img.src = house.logo;
            img.alt = `${house.name} logo`;
            img.style.width = '50px';
            img.style.height = '50px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '8px';
            logoTd.appendChild(img);
        } else {
            const ph = document.createElement('div');
            ph.style.width = '50px';
            ph.style.height = '50px';
            ph.style.background = 'rgba(255,255,255,0.15)';
            ph.style.borderRadius = '8px';
            ph.style.display = 'flex';
            ph.style.alignItems = 'center';
            ph.style.justifyContent = 'center';
            ph.style.color = 'rgba(255,255,255,0.5)';
            ph.textContent = house.name.charAt(0).toUpperCase();
            logoTd.appendChild(ph);
        }
        logoTd.style.cursor = 'pointer';
        logoTd.onclick = () => fileInput.click();
        logoTd.appendChild(fileInput);
        tr.appendChild(logoTd);
        // Name cell
        const nameTd = document.createElement('td');
        nameTd.textContent = house.name;
        tr.appendChild(nameTd);
        // Color cell
        const colourTd = document.createElement('td');
        const badgeSpan = document.createElement('span');
        badgeSpan.className = 'badge';
        badgeSpan.style.backgroundColor = house.color || '#6c757d';
        colourTd.appendChild(badgeSpan);
        tr.appendChild(colourTd);
        // Points cell
        const pointsTd = document.createElement('td');
        pointsTd.textContent = house.points;
        tr.appendChild(pointsTd);
        // Actions cell
        const tdActions = document.createElement('td');
        // Edit button for updating house name and colour
        const btnEdit = document.createElement('button');
        btnEdit.textContent = 'Edit';
        btnEdit.className = 'primary';
        btnEdit.style.marginRight = '0.5rem';
        btnEdit.onclick = () => {
            // Prompt the user for a new name and colour. Provide current values as defaults.
            const newName = prompt('Enter new house name:', house.name);
            if (newName === null) return; // Cancelled
            const newColor = prompt('Enter new house colour (e.g. #007bff or red):', house.color || '');
            if (newColor === null) return;
            // Trim and validate name
            const trimmed = newName.trim();
            if (!trimmed) {
                alert('House name cannot be empty');
                return;
            }
            // Check for duplicate name (case-insensitive) excluding this house
            if (data.houses.some(h => h.id !== house.id && h.name.toLowerCase() === trimmed.toLowerCase())) {
                alert('Another house with that name already exists');
                return;
            }
            house.name = trimmed;
            house.color = newColor.trim() || null;
            saveData(data);
            renderManageHouses(container);
        };
        tdActions.appendChild(btnEdit);
        // Delete button for removing a house
        const btnDel = document.createElement('button');
        btnDel.textContent = 'Delete';
        btnDel.className = 'danger';
        btnDel.onclick = () => {
            if (data.students.some(s => s.houseId === house.id)) {
                alert('Cannot delete house with assigned students');
                return;
            }
            data.houses = data.houses.filter(h => h.id !== house.id);
            saveData(data);
            renderManageHouses(container);
        };
        tdActions.appendChild(btnDel);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
    });
    if (data.houses.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 5;
        td.textContent = 'No houses yet.';
        tr.appendChild(td);
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);
}

// Render manage students page
function renderManageStudents(container) {
    const data = loadData();
    // Clear previous contents
    container.innerHTML = '';
    // Even if no houses exist, allow students to be added without a house
    // Form to add student with grade and photo
    const form = document.createElement('form');
    form.onsubmit = event => {
        event.preventDefault();
        const name = form.querySelector('input[name="studentName"]').value.trim();
        const grade = form.querySelector('input[name="studentGrade"]').value.trim();
        const houseSelect = form.querySelector('select[name="studentHouse"]');
        const houseIdVal = houseSelect.value;
        if (!name) return;
        const houseId = houseIdVal ? parseInt(houseIdVal) : null;
        // Always start with no photo; the photo can be uploaded later by clicking the placeholder in the list
        const student = {
            id: data.nextStudentId++,
            name: name,
            grade: grade || '',
            houseId: houseId,
            points: 0,
            photo: null
        };
        data.students.push(student);
        saveData(data);
        form.reset();
        renderManageStudents(container);
    };
    // Build form fields
    const formHTML = [];
    formHTML.push('<h3>Add Student</h3>');
    formHTML.push('<label>Student Name</label>');
    formHTML.push('<input type="text" name="studentName" required>');
    formHTML.push('<label>Grade Level</label>');
    formHTML.push('<input type="text" name="studentGrade" placeholder="e.g. 5th Grade">');
    formHTML.push('<label>Assign to House</label>');
    let selectHouse = `<select name="studentHouse">`;
    selectHouse += '<option value="">Unassigned</option>';
    data.houses.forEach(h => {
        selectHouse += `<option value="${h.id}">${h.name}</option>`;
    });
    selectHouse += '</select>';
    formHTML.push(selectHouse);
    formHTML.push('<button type="submit" class="success">Add Student</button>');
    form.innerHTML = formHTML.join('');
    container.appendChild(form);
    // Search bar for filtering students by name
    const searchDiv = document.createElement('div');
    searchDiv.style.marginTop = '1.5rem';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search students...';
    searchInput.style.width = '100%';
    searchInput.style.padding = '0.6rem 0.8rem';
    searchInput.style.marginBottom = '1rem';
    searchInput.style.border = '1px solid rgba(255,255,255,0.2)';
    searchInput.style.borderRadius = '6px';
    searchInput.style.background = 'rgba(255,255,255,0.1)';
    searchInput.style.color = '#e2e8f0';
    searchInput.oninput = () => {
        const term = searchInput.value.toLowerCase();
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const nameCell = row.querySelector('td.name-cell');
            if (!nameCell) return;
            const text = nameCell.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    };
    searchDiv.appendChild(searchInput);
    container.appendChild(searchDiv);
    // Build students table with photo and grade columns
    
    // Build grade sections K-5 with collapsible dropdowns
    const gradeDefs = [
        {key:'K', label:'Kindergarten'},
        {key:'1', label:'1st Grade'},
        {key:'2', label:'2nd Grade'},
        {key:'3', label:'3rd Grade'},
        {key:'4', label:'4th Grade'},
        {key:'5', label:'5th Grade'}
    ];

    const sectionsWrap = document.createElement('div');
    sectionsWrap.className = 'grade-sections';

    function normalizeGrade(g) {
        if (!g) return '';
        const s = String(g).trim().toLowerCase();
        if (s === 'k' || s.startsWith('kind')) return 'K';
        const m = s.match(/(k|kindergarten|\d+)/);
        if (!m) return '';
        const val = m[1];
        if (val === 'k' || val === 'kindergarten') return 'K';
        return String(parseInt(val, 10));
    }

    gradeDefs.forEach(gd => {
        const details = document.createElement('details');
        details.style.marginTop = '1rem';
        const summary = document.createElement('summary');
        summary.textContent = gd.label;
        summary.style.cursor = 'pointer';
        summary.style.fontWeight = '600';
        details.appendChild(summary);

        const table = document.createElement('table');
        table.innerHTML = '<thead><tr><th>Photo</th><th>Name</th><th>Grade</th><th>House</th><th>Points</th><th>Actions</th></tr></thead>';
        const tbody = document.createElement('tbody');

        const rows = data.students
            .filter(s => normalizeGrade(s.grade) === gd.key)
            .sort((a,b) => a.name.localeCompare(b.name));

        rows.forEach(student => {
            const house = data.houses.find(h => h.id === student.houseId);
            const tr = document.createElement('tr');
            tr.className = 'student-row';

            // Photo cell ...
            const photoTd = document.createElement('td');
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.style.display = 'none';
            fileInput.onchange = () => {
                const file = fileInput.files && fileInput.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        student.photo = e.target.result;
                        saveData(data);
                        renderManageStudents(container);
                    };
                    reader.readAsDataURL(file);
                }
            };
            const photoDiv = document.createElement('div');
            photoDiv.className = 'photo-cell';
            photoDiv.style.width = '44px';
            photoDiv.style.height = '44px';
            photoDiv.style.borderRadius = '50%';
            photoDiv.style.overflow = 'hidden';
            photoDiv.style.background = '#111827';
            photoDiv.style.display = 'grid';
            photoDiv.style.placeItems = 'center';
            photoDiv.style.cursor = 'pointer';
            photoDiv.title = 'Click to upload/update photo';
            photoDiv.onclick = () => fileInput.click();
            if (student.photo) {
                const img = document.createElement('img');
                img.src = student.photo;
                img.alt = student.name;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                photoDiv.appendChild(img);
            } else {
                const span = document.createElement('span');
                span.textContent = student.name.charAt(0).toUpperCase();
                span.style.fontWeight = '700';
                span.style.fontSize = '1.1rem';
                span.style.color = '#facc15';
                photoDiv.appendChild(span);
            }
            photoTd.appendChild(fileInput);
            photoTd.appendChild(photoDiv);
            tr.appendChild(photoTd);

            // Name
            const nameTd = document.createElement('td');
            nameTd.className = 'name-cell';
            nameTd.textContent = student.name;
            tr.appendChild(nameTd);

            // Grade
            const gradeTd = document.createElement('td');
            gradeTd.textContent = student.grade || '';
            tr.appendChild(gradeTd);

            // House
            const houseTd = document.createElement('td');
            houseTd.textContent = house ? house.name : '—';
            tr.appendChild(houseTd);

            // Points
            const pointsTd = document.createElement('td');
            pointsTd.textContent = student.points;
            tr.appendChild(pointsTd);

            // Actions
            const actionTd = document.createElement('td');
            const btnEdit = document.createElement('button');
            btnEdit.textContent = 'Edit';
            btnEdit.onclick = () => {
                const newName = prompt('Edit student name:', student.name);
                if (newName && newName.trim()) student.name = newName.trim();
                const newGrade = prompt('Edit grade (K,1,2,3,4,5):', student.grade || '');
                if (newGrade !== null) student.grade = newGrade.trim();
                saveData(data);
                renderManageStudents(container);
            };
            const btnDel = document.createElement('button');
            btnDel.textContent = 'Delete';
            btnDel.className = 'danger';
            btnDel.onclick = () => {
                if (confirm('Delete this student? This will also remove their points from their house.')) {
                    if (house) house.points -= student.points;
                    data.students = data.students.filter(s => s.id !== student.id);
                    saveData(data);
                    renderManageStudents(container);
                }
            };
            actionTd.appendChild(btnEdit);
            actionTd.appendChild(btnDel);
            tr.appendChild(actionTd);

            tbody.appendChild(tr);
        });

        if (rows.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 6;
            td.textContent = 'No students in this grade yet.';
            tr.appendChild(td);
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        details.appendChild(table);
        sectionsWrap.appendChild(details);
    });

    container.appendChild(sectionsWrap);
container.appendChild(table);
}

// Display an overlay form for editing a student's information. The overlay includes
// fields for name, grade level and house assignment. On saving, the changes are
// persisted to localStorage and the manage students view is re-rendered. On cancel,
// the overlay is simply removed without making any changes.
function showEditStudentOverlay(student) {
    const data = loadData();
    // Remove any existing overlay to avoid stacking
    const existing = document.getElementById('editStudentOverlay');
    if (existing) existing.remove();
    // Create overlay backdrop
    const overlay = document.createElement('div');
    overlay.id = 'editStudentOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '10000';
    // Build modal container
    const modal = document.createElement('div');
    modal.style.background = 'rgba(15,23,42,0.95)';
    modal.style.padding = '2rem';
    modal.style.borderRadius = '12px';
    modal.style.width = '350px';
    modal.style.maxWidth = '90%';
    modal.style.color = '#f8fafc';
    // Title
    const title = document.createElement('h3');
    title.textContent = 'Edit Student';
    modal.appendChild(title);
    // Form
    const form = document.createElement('form');
    form.onsubmit = event => {
        event.preventDefault();
        const newName = form.querySelector('input[name="editStudentName"]').value.trim();
        const newGrade = form.querySelector('input[name="editStudentGrade"]').value.trim();
        const newHouseIdVal = form.querySelector('select[name="editStudentHouse"]').value;
        const newHouseId = newHouseIdVal ? parseInt(newHouseIdVal) : null;
        // Validate name
        if (!newName) {
            alert('Student name cannot be empty');
            return;
        }
        // Update student fields
        student.name = newName;
        student.grade = newGrade;
        // If house assignment changes, adjust points between houses
        if (student.houseId !== newHouseId) {
            const oldHouse = data.houses.find(h => h.id === student.houseId);
            const newHouse = data.houses.find(h => h.id === newHouseId);
            // Remove points from old house
            if (oldHouse) oldHouse.points -= student.points;
            // Add points to new house
            if (newHouse) newHouse.points += student.points;
            student.houseId = newHouseId;
        }
        saveData(data);
        overlay.remove();
        // Re-render students list
        const contentArea = document.getElementById('contentArea');
        renderManageStudents(contentArea);
    };
    // Name field
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Name';
    form.appendChild(nameLabel);
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.name = 'editStudentName';
    nameInput.value = student.name;
    nameInput.required = true;
    form.appendChild(nameInput);
    // Grade field
    const gradeLabel = document.createElement('label');
    gradeLabel.textContent = 'Grade Level';
    form.appendChild(gradeLabel);
    const gradeInput = document.createElement('input');
    gradeInput.type = 'text';
    gradeInput.name = 'editStudentGrade';
    gradeInput.value = student.grade || '';
    form.appendChild(gradeInput);
    // House select
    const houseLabel = document.createElement('label');
    houseLabel.textContent = 'House';
    form.appendChild(houseLabel);
    const houseSelect = document.createElement('select');
    houseSelect.name = 'editStudentHouse';
    // Option for unassigned
    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.textContent = 'Unassigned';
    houseSelect.appendChild(optNone);
    data.houses.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h.id;
        opt.textContent = h.name;
        if (student.houseId === h.id) opt.selected = true;
        houseSelect.appendChild(opt);
    });
    form.appendChild(houseSelect);
    // Buttons container
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.justifyContent = 'flex-end';
    btnRow.style.gap = '0.5rem';
    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'danger';
    cancelBtn.onclick = () => {
        overlay.remove();
    };
    btnRow.appendChild(cancelBtn);
    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.textContent = 'Save';
    saveBtn.className = 'success';
    btnRow.appendChild(saveBtn);
    form.appendChild(btnRow);
    modal.appendChild(form);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

// Render manage teachers page

function renderManageTeachers(container) {
    const data = loadData();
    container.innerHTML = '';

    // Create Teacher Profile form
    const form = document.createElement('form');
    form.onsubmit = (event) => {
        event.preventDefault();
        const name = form.querySelector('input[name="teacherName"]').value.trim();
        const username = form.querySelector('input[name="teacherUsername"]').value.trim().toLowerCase();
        const password = form.querySelector('input[name="teacherPassword"]').value.trim();
        const houseIdVal = parseInt(form.querySelector('select[name="teacherHouse"]').value, 10);
        if (!name || !username || !password || !houseIdVal) return;
        if (data.users.find(u => (u.username || '').toLowerCase() === username)) {
            alert('Username already exists');
            return;
        }
        const gradeAccess = Array.from(form.querySelectorAll('input[name="gradeAccess"]:checked')).map(cb => cb.value);
        const assignedIds = Array.from(form.querySelectorAll('input[name="assignStudents"]:checked')).map(cb => parseInt(cb.value,10));
        const user = { name, username, password, role: 'teacher', houseId: houseIdVal, gradeAccess, accessibleStudentIds: assignedIds };
        data.users.push(user);
        saveData(data);
        form.reset();
        renderManageTeachers(container);
    };

    form.innerHTML = `
        <h3>Create Teacher Profile</h3>
        <label>Name</label>
        <input type="text" name="teacherName" required>
        <label>Username</label>
        <input type="text" name="teacherUsername" required>
        <label>Password</label>
        <div style="display:flex;gap:.5rem;align-items:center;">
            <input type="password" name="teacherPassword" required id="newTeacherPwd">
            <button type="button" id="toggleNewPwd">Show</button>
        </div>
        <label>Assign Grade(s)</label>
        <div class="grade-checkboxes">
            ${[['K','K'],['1','1st'],['2','2nd'],['3','3rd'],['4','4th'],['5','5th']].map(([k,l]) => 
                `<label style="margin-right:10px;"><input type="checkbox" name="gradeAccess" value="${k}">${l}</label>`
            ).join('')}
        </div>
        <label>Assign House</label
        <select name="teacherHouse" required>
            ${data.houses.map(h => `<option value="${h.id}">${h.name}</option>`).join('')}
        </select>
        <button type="submit" class="success">Create Teacher</button>
    `;
    container.appendChild(form);
    const toggleNewPwdBtn = form.querySelector('#toggleNewPwd');
    toggleNewPwdBtn.onclick = () => {
        const pwd = form.querySelector('#newTeacherPwd');
        pwd.type = pwd.type === 'password' ? 'text' : 'password';
        toggleNewPwdBtn.textContent = pwd.type === 'password' ? 'Show' : 'Hide';
    };

    // List teachers
    const teachers = data.users.filter(u => u.role === 'teacher');
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Name</th><th>Username</th><th>House</th><th>Grades</th><th>Assigned</th><th>Password</th><th>Actions</th></tr></thead>';
    const tbody = document.createElement('tbody');

    function formatGrades(arr) {
        if (!arr || !arr.length) return '—';
        const map = {K:'K',1:'1st',2:'2nd',3:'3rd',4:'4th',5:'5th'};
        return arr.map(g => map[g] || g).join(', ');
    }

    teachers.forEach(teacher => {
        if (!Array.isArray(teacher.gradeAccess)) teacher.gradeAccess = [];
        const tr = document.createElement('tr');
        const house = data.houses.find(h => h.id === teacher.houseId);

        const tdName = document.createElement('td'); tdName.textContent = teacher.name || '—'; tr.appendChild(tdName);
        const tdUser = document.createElement('td'); tdUser.textContent = teacher.username; tr.appendChild(tdUser);
        const tdHouse = document.createElement('td'); tdHouse.textContent = house ? house.name : '—'; tr.appendChild(tdHouse);
        const tdGrades = document.createElement('td'); tdGrades.textContent = formatGrades(teacher.gradeAccess); tr.appendChild(tdGrades);

                const tdAssigned = document.createElement('td');
        const assignedArr = Array.isArray(teacher.accessibleStudentIds) ? teacher.accessibleStudentIds : [];
        tdAssigned.textContent = String(assignedArr.length);
        tr.appendChild(tdAssigned);
const tdPwd = document.createElement('td');
        const pwdSpan = document.createElement('span'); pwdSpan.textContent = '••••••';
        const btnShow = document.createElement('button'); btnShow.textContent = 'Show'; btnShow.type = 'button'; btnShow.style.marginLeft = '.5rem';
        let showing = false; // We'll correct to JS lower-case true/false later
        btnShow.onclick = () => {
            showing = !showing;
            pwdSpan.textContent = showing ? (teacher.password || '') : '••••••';
            btnShow.textContent = showing ? 'Hide' : 'Show';
        };
        const btnEditPwd = document.createElement('button'); btnEditPwd.textContent = 'Edit'; btnEditPwd.type = 'button'; btnEditPwd.style.marginLeft = '.5rem';
        btnEditPwd.onclick = () => {
            const newPwd = prompt('Enter new password for ' + teacher.username + ':', teacher.password || '');
            if (newPwd !== null) { teacher.password = String(newPwd); saveData(data); if (showing) pwdSpan.textContent = teacher.password; }
        };
        tdPwd.appendChild(pwdSpan); tdPwd.appendChild(btnShow); tdPwd.appendChild(btnEditPwd);
        tr.appendChild(tdPwd);

        const tdActions = document.createElement('td');
        const btnEditProfile = document.createElement('button'); btnEditProfile.textContent = 'Edit Profile'; btnEditProfile.type = 'button';
        btnEditProfile.onclick = () => {
            const newName = prompt('Name:', teacher.name || '');
            if (newName !== null) teacher.name = newName.trim();
            const houseIdStr = prompt('House ID (from Houses tab):', house ? String(house.id) : '');
            if (houseIdStr !== null && houseIdStr.trim() !== '' && !isNaN(parseInt(houseIdStr,10))) teacher.houseId = parseInt(houseIdStr,10);
            const currentGrades = (teacher.gradeAccess || []).join(',');
            const input = prompt('Grades (comma separated: K,1,2,3,4,5):', currentGrades);
            if (input !== null) {
                const parts = input.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                const normalized = parts.map(p => (p === 'K' || p === 'KINDERGARTEN') ? 'K' : String(parseInt(p,10))).filter(v => ['K','1','2','3','4','5'].includes(v));
                teacher.gradeAccess = Array.from(new Set(normalized));
            }
            saveData(data);
            renderManageTeachers(container);
        };
        tdActions.appendChild(btnEditProfile);
                const btnAssign = document.createElement('button'); btnAssign.textContent = 'Manage Assigned'; btnAssign.type = 'button'; btnAssign.style.marginLeft = '.5rem';
        btnAssign.onclick = () => openAssignStudentsModal(teacher);
        tdActions.appendChild(btnAssign);
const btnDel = document.createElement('button'); btnDel.textContent = 'Delete'; btnDel.className = 'danger'; btnDel.style.marginLeft = '.5rem';
        btnDel.onclick = () => { if (confirm('Delete this teacher?')) { data.users = data.users.filter(u => u.username !== teacher.username); saveData(data); renderManageTeachers(container);} };
        tdActions.appendChild(btnDel);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
    });

    if (teachers.length === 0) {
        const tr = document.createElement('tr'); const td = document.createElement('td');
        td.colSpan = 6; td.textContent = 'No teachers yet.'; tr.appendChild(td); tbody.appendChild(tr);
    }

    table.appendChild(tbody); container.appendChild(table);
}


// Render transaction history
function renderTransactions(container) {
    const data = loadData();
    const currentUser = getCurrentUser();

    // Ensure all transactions have an ID (migration for older data)
    if (typeof data.nextTransactionId !== 'number') {
        data.nextTransactionId = 1;
    }
    let didAssign = false;
    for (const txn of data.transactions) {
        if (txn.id === undefined || txn.id === null) {
            txn.id = data.nextTransactionId++;
            didAssign = true;
        }
    }
    if (didAssign) {
        saveData(data);
    }
    // Determine transactions to show
    let txns;
    if (currentUser.role === 'admin') {
        txns = data.transactions;
    } else {
        txns = data.transactions.filter(txn => txn.teacherUsername === currentUser.username);
    }
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Date/Time</th><th>Teacher</th><th>Student</th><th>House</th><th>Amount</th><th>Note</th></tr></thead>';
    const tbody = document.createElement('tbody');
    txns
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .forEach(txn => {
            const student = data.students.find(s => s.id === txn.studentId);
            const house = data.houses.find(h => h.id === txn.houseId);
            const tr = document.createElement('tr');
            const date = new Date(txn.timestamp).toLocaleString();
            const amountString = (txn.amount >= 0 ? '+' : '') + txn.amount;
            tr.innerHTML = `<td>${date}</td><td>${txn.teacherUsername}</td><td>${student ? student.name : ''}</td><td>${house ? house.name : ''}</td><td>${amountString}</td><td>${txn.note || ''}</td><td><button class="btn-delete-txn" data-txn-id="${txn.id}" onclick="(function(id){ if(confirm(\'Delete this transaction? This will reverse the points.\')){ deleteTransaction(id); const container=document.getElementById(\'contentArea\'); container.innerHTML=\'\'; renderTransactions(container);} })(parseInt(this.dataset.txnId,10))">Delete</button></td>`;
            tbody.appendChild(tr);
        });
    if (txns.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7;
        td.textContent = 'No transactions yet.';
        tr.appendChild(td);
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);
}

// Run a podium ceremony animation that reveals places one by one and celebrates the winner
function runCeremony() {
    const contentArea = document.getElementById('contentArea');
    const data = loadData();
    const houses = [...data.houses].sort((a, b) => b.points - a.points);
    if (houses.length === 0) return;
    // Clear the content area
    contentArea.innerHTML = '';
    // Ceremony container
    const cerContainer = document.createElement('div');
    cerContainer.id = 'ceremonyContainer';
    cerContainer.style.display = 'flex';
    cerContainer.style.flexDirection = 'column';
    cerContainer.style.alignItems = 'center';
    cerContainer.style.gap = '1rem';
    contentArea.appendChild(cerContainer);

    // Start ceremony music
    playCeremonyMusic();
    // Helper to create a row element for a house
    const createRow = (house, label) => {
        const row = document.createElement('div');
        row.className = 'leaderboard-row';
        const rankDiv = document.createElement('div');
        rankDiv.className = 'rank';
        rankDiv.textContent = label;
        row.appendChild(rankDiv);
        const logoDiv = document.createElement('div');
        logoDiv.className = 'logo';
        if (house.logo) {
            const img = document.createElement('img');
            img.src = house.logo;
            img.alt = `${house.name} logo`;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            logoDiv.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'house-logo-placeholder';
            placeholder.textContent = house.name.charAt(0).toUpperCase();
            logoDiv.appendChild(placeholder);
        }
        row.appendChild(logoDiv);
        const details = document.createElement('div');
        details.className = 'details';
        const nameEl = document.createElement('h4');
        nameEl.textContent = house.name;
        const pointsEl = document.createElement('h3');
        pointsEl.textContent = `${house.points} pts`;
        pointsEl.style.fontSize = '2rem';
        pointsEl.style.color = '#facc15';
        pointsEl.style.margin = '0.25rem 0 0';
        details.appendChild(nameEl);
        details.appendChild(pointsEl);
        row.appendChild(details);
        return row;
    };
    // Function to launch confetti for the winner
    const launchConfetti = () => {
        const confContainer = document.createElement('div');
        confContainer.className = 'confetti-container';
        document.body.appendChild(confContainer);
        const colors = ['#fbbf24', '#f472b6', '#6ee7b7', '#93c5fd', '#fda4af'];
        for (let i = 0; i < 60; i++) {
            const conf = document.createElement('div');
            conf.className = 'confetti';
            conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            conf.style.left = Math.random() * 100 + '%';
            conf.style.animationDelay = Math.random() * 0.5 + 's';
            confContainer.appendChild(conf);
        }
        // Remove confetti after 4 seconds
        setTimeout(() => {
            confContainer.remove();
        }, 4000);
    };
    // Async function to display places sequentially
    async function showCeremony() {
        // 4th place
        if (houses[3]) {
            const row4 = createRow(houses[3], '4th Place');
            cerContainer.appendChild(row4);
            // Wait twice as long before showing 3rd place
            await new Promise(res => setTimeout(res, 4000));
        }
        // 3rd place
        if (houses[2]) {
            const row3 = createRow(houses[2], '3rd Place');
            cerContainer.appendChild(row3);
            // Wait three times as long before the final announcement
            await new Promise(res => setTimeout(res, 6000));
        }
        // Final reveal: 2nd and 1st together
        const finalContainer = document.createElement('div');
        finalContainer.style.display = 'flex';
        finalContainer.style.gap = '1rem';
        // 2nd place
        if (houses[1]) {
            const row2 = createRow(houses[1], '2nd Place');
            finalContainer.appendChild(row2);
        }
        // 1st place
        const row1 = createRow(houses[0], '1st Place');
        finalContainer.appendChild(row1);
        cerContainer.appendChild(finalContainer);
        // Launch confetti over the winner
        launchConfetti();
        // Stop music a few seconds after confetti begins
        setTimeout(stopCeremonyMusic, 5000);
    }
    showCeremony();
}

// Audio has been disabled per user request. The following functions are intentionally left
// blank so that no soundtrack plays during the ceremony. We still declare
// `ceremonyAudioCtx` to avoid reference errors elsewhere in the code.
let ceremonyAudioCtx = null;
function playCeremonyMusic() {
    // Intentionally empty: soundtrack removed by request
}

function stopCeremonyMusic() {
    // Intentionally empty: no audio to clean up
}

// Render rewards management/view page
function renderRewards(container) {
    const data = loadData();
    const currentUser = getCurrentUser();
    container.innerHTML = '';
    // Admin can add new rewards
    if (currentUser.role === 'admin') {
        const form = document.createElement('form');
        form.onsubmit = event => {
            event.preventDefault();
            const name = form.querySelector('input[name="rewardName"]').value.trim();
            const costVal = parseInt(form.querySelector('input[name="rewardCost"]').value);
            if (!name || isNaN(costVal)) return;
            const reward = {
                id: data.nextRewardId++,
                name: name,
                cost: costVal
            };
            data.rewards.push(reward);
            saveData(data);
            form.reset();
            renderRewards(container);
        };
        form.innerHTML = `
            <h3>Add Reward</h3>
            <label>Reward Name</label>
            <input type="text" name="rewardName" required>
            <label>Point Cost</label>
            <input type="number" name="rewardCost" min="1" required>
            <button type="submit" class="success">Add Reward</button>
        `;
        container.appendChild(form);
    }
    // List existing rewards
    const rewards = data.rewards;
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Name</th><th>Cost</th>' + (currentUser.role === 'admin' ? '<th>Actions</th>' : '') + '</tr></thead>';
    const tbody = document.createElement('tbody');
    rewards.forEach(rew => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${rew.name}</td><td>${rew.cost} pts</td><td><button class="btn-delete-txn" data-txn-id="${txn.id}" onclick="(function(id){ if(confirm(\'Delete this transaction? This will reverse the points.\')){ deleteTransaction(id); const container=document.getElementById(\'contentArea\'); container.innerHTML=\'\'; renderTransactions(container);} })(parseInt(this.dataset.txnId,10))">Delete</button></td>`;
        if (currentUser.role === 'admin') {
            const tdActions = document.createElement('td');
            const btnDel = document.createElement('button');
            btnDel.textContent = 'Delete';
            btnDel.className = 'danger';
            btnDel.onclick = () => {
                if (confirm('Delete this reward?')) {
                    data.rewards = data.rewards.filter(r => r.id !== rew.id);
                    saveData(data);
                    renderRewards(container);
                }
            };
            tdActions.appendChild(btnDel);
            tr.appendChild(tdActions);
        }
        tbody.appendChild(tr);
    });
    if (rewards.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = currentUser.role === 'admin' ? 3 : 2;
        td.textContent = 'No rewards yet.';
        tr.appendChild(td);
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);
}

// Render sorting wheel page (admin)
function renderSortingWheel(container) {
    const data = loadData();
    const currentUser = getCurrentUser();
    container.innerHTML = '';
    if (currentUser.role !== 'admin') return;
    // Require at least one house and student to sort
    if (data.houses.length === 0 || data.students.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'Add houses and students before using the sorting wheel.';
        container.appendChild(p);
        return;
    }
    // Heading and instructions
    const heading = document.createElement('h3');
    heading.textContent = 'Sorting Wheel';
    container.appendChild(heading);
    const instructions = document.createElement('p');
    instructions.textContent = 'Select a student and spin the wheel to assign them to a house at random.';
    // Capacity settings UI
    const settingsCard = document.createElement('div');
    settingsCard.className = 'card';
    settingsCard.style.padding = '.75rem';
    settingsCard.style.margin = '0 0 1rem 0';
    const settingsTitle = document.createElement('h4');
    settingsTitle.textContent = 'House Capacity (Optional)';
    settingsCard.appendChild(settingsTitle);
    const settingsHelp = document.createElement('p');
    settingsHelp.textContent = 'Set a max number of students per house. If a house is full, the wheel will spin again automatically.';
    settingsCard.appendChild(settingsHelp);

    if (!data.houseLimits || typeof data.houseLimits !== 'object') data.houseLimits = {};

    const limitsTable = document.createElement('table');
    limitsTable.className = 'table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>House</th><th>Current</th><th>Limit</th></tr>';
    limitsTable.appendChild(thead);
    const tbody = document.createElement('tbody');

    const houseCounts = {};
    data.houses.forEach(h => { houseCounts[h.id] = data.students.filter(s => s.houseId === h.id).length; });

    data.houses.forEach(h => {
        const tr = document.createElement('tr');
        const tdName = document.createElement('td'); tdName.textContent = h.name; tr.appendChild(tdName);
        const tdCur = document.createElement('td'); tdCur.textContent = houseCounts[h.id]; tr.appendChild(tdCur);
        const tdLimit = document.createElement('td');
        const inp = document.createElement('input');
        inp.type = 'number'; inp.min = '0'; inp.placeholder = 'No limit';
        if (data.houseLimits[h.id] !== undefined) inp.value = data.houseLimits[h.id];
        inp.onchange = () => {
            const v = inp.value.trim();
            if (v === '') { delete data.houseLimits[h.id]; }
            else { data.houseLimits[h.id] = Math.max(0, parseInt(v, 10)); }
            saveData(data);
        };
        tdLimit.appendChild(inp);
        tr.appendChild(tdLimit);
        tbody.appendChild(tr);
    });
    limitsTable.appendChild(tbody);
    settingsCard.appendChild(limitsTable);
    container.appendChild(settingsCard);

    container.appendChild(instructions);
    // Dropdown of students to assign (unassigned or reassign)
    const form = document.createElement('div');
    form.style.marginBottom = '1rem';
    const labelStu = document.createElement('label');
    labelStu.textContent = 'Select Student';
    form.appendChild(labelStu);
    const selectStu = document.createElement('select');
    data.students.forEach(stu => {
        const opt = document.createElement('option');
        opt.value = stu.id;
        opt.textContent = `${stu.name}`;
        selectStu.appendChild(opt);
    });
    form.appendChild(selectStu);
    container.appendChild(form);
    // --- High‑definition wheel image with stationary pointer ---
    const wheelContainer = document.createElement('div');
    wheelContainer.style.position = 'relative';
    wheelContainer.style.margin = '2rem auto';
    // Increase the overall size of the wheel to make it more prominent. Both the
    // container and the image are now 400px square instead of 320px.
    wheelContainer.style.width = '400px';
    wheelContainer.style.height = '400px';
    wheelContainer.style.display = 'flex';
    wheelContainer.style.justifyContent = 'center';
    wheelContainer.style.alignItems = 'center';
    // Wheel image (HD, 3D, science themed)
    const wheelImg = document.createElement('img');
    wheelImg.id = 'sortingWheel';
    wheelImg.src = 'img/wheel_hd.png';
    wheelImg.alt = 'Sorting Wheel';
    wheelImg.style.width = '400px';
    wheelImg.style.height = '400px';
    wheelImg.style.borderRadius = '50%';
    wheelImg.style.display = 'block';
    wheelImg.style.objectFit = 'cover';
    wheelImg.style.transition = 'transform 5s cubic-bezier(0.33,1,0.68,1)';
    wheelContainer.appendChild(wheelImg);
    // Pointer element (stationary)
    const pointer = document.createElement('div');
    pointer.style.width = '0';
    pointer.style.height = '0';
    pointer.style.borderLeft = '18px solid transparent';
    pointer.style.borderRight = '18px solid transparent';
    pointer.style.borderBottom = '32px solid #facc15';
    pointer.style.position = 'absolute';
    // Position the pointer so its tip rests on the wheel's rim
    pointer.style.top = '0px';
    pointer.style.left = 'calc(50% - 18px)';
    pointer.style.filter = 'drop-shadow(0 3px 3px rgba(0,0,0,0.5))';
    // Rotate pointer 180 degrees if needed so its tip points toward the wheel
    pointer.style.transform = 'rotate(180deg)';
    wheelContainer.appendChild(pointer);
    container.appendChild(wheelContainer);
    // Result display
    const resultDiv = document.createElement('div');
    resultDiv.style.textAlign = 'center';
    resultDiv.style.fontWeight = '600';
    resultDiv.style.marginTop = '1rem';
    container.appendChild(resultDiv);
    // Spin button
    const btn = document.createElement('button');
    btn.textContent = 'Spin Wheel';
    btn.className = 'primary';
    btn.onclick = () => {
        // Ensure at least 4 full rotations of the wheel before stopping
        const spins = Math.floor(Math.random() * 4) + 4; // 4 to 7 full spins
        const randAngle = Math.floor(Math.random() * 360);
        const finalAngle = spins * 360 + randAngle;
        // Rotate the wheel image
        const rotWheel = document.getElementById('sortingWheel');
        resultDiv.textContent = '';
        rotWheel.style.transform = `rotate(${finalAngle}deg)`;
        // Determine selected house after animation ends
        rotWheel.addEventListener('transitionend', function handler() {
            rotWheel.removeEventListener('transitionend', handler);
            // Normalize angle to 0-359
            const normalized = (360 - (finalAngle % 360)) % 360;
            // Four equal segments: each 90 degrees
            const segSizeLocal = 360 / 4;
            let index = Math.floor(normalized / segSizeLocal);
            // Map the 4 quadrants to specific house names
            // Mapping of segment index to house names (clockwise from the pointer)
            // Index 0: Blue -> Darwin, 1: Yellow -> Curie, 2: Green -> Hippocretes, 3: Red -> Newton
            const nameMapping = ['Darwin','Curie','Hippocretes','Newton'];
            // Determine desired house name for this segment
            const desiredName = nameMapping[index % nameMapping.length];
            let selectedHouse = data.houses.find(h => h.name.toLowerCase() === desiredName.toLowerCase());
            // Fallback: if not found, use index mapping
            if (!selectedHouse) {
                if (data.houses.length > 0) {
                    selectedHouse = data.houses[index % data.houses.length];
                }
            }
            
            // Assign student to selected house if both exist, respecting capacity limits
            const getLimit = (hid) => (data.houseLimits && data.houseLimits[hid] !== undefined) ? parseInt(data.houseLimits[hid],10) : null;
            const getCount = (hid) => data.students.filter(s => s.houseId === hid).length;
            const isEligible = (hid) => {
                const lim = getLimit(hid);
                if (lim === null || isNaN(lim)) return true;
                return getCount(hid) < lim;
            };

            const studentId = parseInt(selectStu.value);
            const student = data.students.find(s => s.id === studentId);

            
            // Auto-respin if selected house is at capacity, up to a safety cap.
            // Use cumulative wheel angle so segment -> house mapping stays correct.
            let attempts = 0;
            const maxAttempts = 20;
            let baseAngle = finalAngle; // start from the first spin's final angle
            while (selectedHouse && !isEligible(selectedHouse.id) && attempts < maxAttempts) {
                const spins2 = Math.floor(Math.random() * 4) + 1; // 1–4 extra spins
                const randAngle2 = Math.floor(Math.random() * 360);
                const delta = spins2 * 360 + randAngle2;
                baseAngle += delta;
                resultDiv.textContent = '';
        rotWheel.style.transform = `rotate(${baseAngle}deg)`;

                // Map the new final angle to a segment index just like the first spin
                const normalized2 = (360 - (baseAngle % 360)) % 360;
                let index2 = Math.floor(normalized2 / segSizeLocal);

                if (nameMapping && nameMapping.length === 4) {
                    const name2 = nameMapping[index2 % 4];
                    const house2 = data.houses.find(h => h.name.toLowerCase() === name2.toLowerCase());
                    selectedHouse = house2 || selectedHouse;
                } else {
                    selectedHouse = data.houses.find((h, i) => i === index2 % data.houses.length) || selectedHouse;
                }
                attempts++;
            }
            

            if (selectedHouse && student) {
                if (data.houseLimits && data.houseLimits[selectedHouse.id] !== undefined && getCount(selectedHouse.id) >= getLimit(selectedHouse.id)) {
                    // Skip announcing on full house, just respin silently
                    const spins2 = Math.floor(Math.random()*3)+3;
                    const randAngle2 = Math.floor(Math.random()*360);
                    const delta = spins2*360 + randAngle2;
                    baseAngle += delta;
                    resultDiv.textContent = '';
        rotWheel.style.transform = `rotate(${baseAngle}deg)`;
                    return;
                } else {
                    student.houseId = selectedHouse.id;
                    saveData(data);
                    if (selectedHouse) {
                        resultDiv.textContent = `${student.name} sorted into ${selectedHouse.name}!`;
                    }
                }
            }
        });
    };
    container.appendChild(btn);
}


// Show main page after login
function showMainPage() {
    document.getElementById('loginPage').classList.add('d-none');
    // Hide the landing page (hero + features) once the user logs in
    const landing = document.getElementById('landingPage');
    if (landing) landing.classList.add('d-none');
    document.getElementById('mainPage').classList.remove('d-none');
    document.getElementById('navbar').style.display = 'flex';
    // Display username
    const currentUser = getCurrentUser();
    const userDisplay = document.getElementById('currentUserDisplay');
    userDisplay.textContent = `Logged in as ${currentUser.username} (${currentUser.role})`;
    document.getElementById('logoutLink').style.display = 'inline';
    // Build navigation and show leaderboard by default
    renderNavTabs();
    const firstSection = (getCurrentUser().role === 'admin') ? 'leaderboard' : 'award';
    showSection(firstSection);
}

// On page load
window.onload = () => {
    initData();
    const currentUser = getCurrentUser();
    if (currentUser) {
        showMainPage();
    }
};

// Delete a transaction by ID and reverse its effects
function deleteTransaction(txnId) {
    const data = loadData();
    const idx = data.transactions.findIndex(t => t.id === txnId);
    if (idx === -1) return false;
    const txn = data.transactions[idx];
    // Reverse student points
    const student = data.students.find(s => s.id === txn.studentId);
    if (student) {
        student.points -= txn.amount;
    }
    // Reverse house points if applicable
    if (txn.houseId !== null && txn.houseId !== undefined) {
        const house = data.houses.find(h => h.id === txn.houseId);
        if (house) {
            house.points -= txn.amount;
        }
    }
    // Remove txn
    data.transactions.splice(idx, 1);
    saveData(data);
    return true;
}


function openAssignStudentsModal(teacher) {
    const data = loadData();
    if (!Array.isArray(teacher.accessibleStudentIds)) teacher.accessibleStudentIds = [];
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';
    const title = document.createElement('h3');
    title.textContent = `Assign Students to ${teacher.name || teacher.username}`;
    modal.appendChild(title);

    // Search input
    const search = document.createElement('input');
    search.type = 'text';
    search.placeholder = 'Search students by name...';
    search.style.marginBottom = '.5rem';
    modal.appendChild(search);

    // List container
    const list = document.createElement('div');
    list.style.maxHeight = '320px';
    list.style.overflow = 'auto';
    list.style.border = '1px solid #ddd';
    list.style.padding = '.5rem';
    list.style.borderRadius = '.5rem';
    modal.appendChild(list);

    function renderList(filter='') {
        list.innerHTML = '';
        const term = filter.trim().toLowerCase();
        data.students
            .filter(s => !term || (s.name || '').toLowerCase().includes(term))
            .sort((a,b)=> (a.name||'').localeCompare(b.name||''))
            .forEach(s => {
                const label = document.createElement('label');
                label.style.display = 'block';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = teacher.accessibleStudentIds.includes(s.id);
                cb.onchange = () => {
                    if (cb.checked) {
                        if (!teacher.accessibleStudentIds.includes(s.id)) teacher.accessibleStudentIds.push(s.id);
                    } else {
                        teacher.accessibleStudentIds = teacher.accessibleStudentIds.filter(id => id !== s.id);
                    }
                };
                label.appendChild(cb);
                const house = data.houses.find(h=>h.id===s.houseId);
                label.append(` ${s.name} (G${s.grade || ''}${house ? ', ' + house.name : ''})`);
                list.appendChild(label);
            });
    }
    renderList();
    search.oninput = () => renderList(search.value);

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.justifyContent = 'flex-end';
    btnRow.style.gap = '.5rem';
    btnRow.style.marginTop = '.75rem';

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.textContent = 'Cancel';
    btnCancel.onclick = () => document.body.removeChild(overlay);
    const btnSave = document.createElement('button');
    btnSave.type = 'button';
    btnSave.className = 'success';
    btnSave.textContent = 'Save';
    btnSave.onclick = () => {
        saveData(data);
        document.body.removeChild(overlay);
        // refresh teachers page if open
        const contentArea = document.getElementById('content');
        if (contentArea && document.querySelector('[data-section].active')?.dataset.section === 'teachers') {
            renderManageTeachers(contentArea);
        }
    };

    btnRow.appendChild(btnCancel);
    btnRow.appendChild(btnSave);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}
