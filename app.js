let db;
const request = indexedDB.open('clientDB', 1);

request.onupgradeneeded = function(event) {
    db = event.target.result;
    const objectStore = db.createObjectStore('clients', { keyPath: 'name' });
    objectStore.createIndex('debt', 'debt', { unique: false });
    objectStore.createIndex('status', 'status', { unique: false });
    objectStore.createIndex('company', 'company', { unique: false });
    objectStore.createIndex('date', 'date', { unique: false });
    objectStore.createIndex('payments', 'payments', { unique: false });
};

request.onsuccess = function(event) {
    db = event.target.result;
    loadClients();
    updateStats();
};

request.onerror = function(event) {
    console.log('Error opening database:', event);
};

document.getElementById('client-form').addEventListener('submit', function(event) {
    event.preventDefault();
    
    const clientName = document.getElementById('client-name').value;
    const clientDebt = document.getElementById('client-debt').value;
    const company = document.getElementById('company').value;
    const date = new Date().toLocaleString('es-NI', { timeZone: 'America/Managua' });

    addClient(clientName, clientDebt, company, date);
    saveClient(clientName, clientDebt, company, date);
    
    // Limpiar el formulario después de agregar el cliente
    document.getElementById('client-form').reset();
});

function addClient(name, debt, company, date, status = 'No pagado') {
    const table = document.getElementById('client-list');
    const row = table.insertRow();
    row.innerHTML = `
        <td>${name}</td>
        <td>${debt}</td>
        <td data-status="${status.toLowerCase()}">${status}</td>
        <td>${company}</td>
        <td>${date}</td>
        <td>
            <button class="paid" onclick="markAsPaid(this)">Marcar como pagado</button>
            <button class="debt" onclick="markAsDebt(this)">Aún debe</button>
            <button class="edit" onclick="editClient(this)">Editar</button>
            <button class="edit" onclick="recordPayment(this)">Registrar Abono</button>
            <button class="debt" onclick="removeClient(this)">Eliminar</button>
        </td>
    `;
    updateStats();
}

function markAsPaid(button) {
    const row = button.parentElement.parentElement;
    const name = row.cells[0].textContent;
    row.cells[2].textContent = 'Pagado';
    row.cells[2].dataset.status = 'pagado';
    updateClientInIndexedDB(name, 'Pagado');
    updateStats();
}

function markAsDebt(button) {
    const row = button.parentElement.parentElement;
    const name = row.cells[0].textContent;
    row.cells[2].textContent = 'No pagado';
    row.cells[2].dataset.status = 'debe';
    updateClientInIndexedDB(name, 'No pagado');
    updateStats();
}

function editClient(button) {
    const row = button.parentElement.parentElement;
    const name = row.cells[0].textContent;
    const currentDebt = row.cells[1].textContent;
    const newDebt = prompt("Ingrese el nuevo monto de la deuda:", currentDebt);
    
    if (newDebt !== null) {
        row.cells[1].textContent = newDebt;
        updateClientInIndexedDB(name, row.cells[2].textContent, newDebt);
    }
}

function recordPayment(button) {
    const row = button.parentElement.parentElement;
    const name = row.cells[0].textContent;
    const paymentAmount = prompt("Ingrese el monto del abono:");

    if (paymentAmount !== null) {
        const currentDebt = parseFloat(row.cells[1].textContent);
        const newDebt = currentDebt - parseFloat(paymentAmount);
        
        if (newDebt <= 0) {
            row.cells[1].textContent = '0';
            row.cells[2].textContent = 'Pagado';
            row.cells[2].dataset.status = 'pagado';
        } else {
            row.cells[1].textContent = newDebt.toFixed(2);
        }
        
        updateClientInIndexedDB(name, row.cells[2].textContent, newDebt.toFixed(2));
    }
}

function removeClient(button) {
    const row = button.parentElement.parentElement;
    const name = row.cells[0].textContent;
    removeClientFromIndexedDB(name);
    row.remove();
    updateStats();
}

function saveClient(name, debt, company, date) {
    const transaction = db.transaction(['clients'], 'readwrite');
    const objectStore = transaction.objectStore('clients');
    const client = { name, debt, company, status: 'No pagado', date, payments: [] };
    objectStore.put(client);
}

function updateClientInIndexedDB(name, status, debt = null) {
    const transaction = db.transaction(['clients'], 'readwrite');
    const objectStore = transaction.objectStore('clients');
    const request = objectStore.get(name);
    
    request.onsuccess = function(event) {
        const client = event.target.result;
        client.status = status;
        if (debt !== null) client.debt = debt;
        objectStore.put(client);
    };
}

function removeClientFromIndexedDB(name) {
    const transaction = db.transaction(['clients'], 'readwrite');
    const objectStore = transaction.objectStore('clients');
    objectStore.delete(name);
}

function loadClients() {
    const transaction = db.transaction(['clients']);
    const objectStore = transaction.objectStore('clients');
    const request = objectStore.openCursor();
    
    request.onsuccess = function(event) {
        const cursor = event.target.result;
        if (cursor) {
            addClient(cursor.value.name, cursor.value.debt, cursor.value.company, cursor.value.date, cursor.value.status);
            cursor.continue();
        }
    };
}

function updateStats() {
    const companies = ['Avon', 'Scentia', 'Zermat'];
    companies.forEach(company => {
        const list = document.getElementById(`${company.toLowerCase()}-list`);
        list.innerHTML = '';
        
        const transaction = db.transaction(['clients']);
        const objectStore = transaction.objectStore('clients');
        const index = objectStore.index('company');
        const request = index.openCursor(IDBKeyRange.only(company));
        
        request.onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                const listItem = document.createElement('li');
                listItem.textContent = `${cursor.value.name} debe ${cursor.value.debt} (${cursor.value.status})`;
                listItem.style.color = cursor.value.status === 'Pagado' ? '#28a745' : '#dc3545';
                list.appendChild(listItem);
                cursor.continue();
            }
        };
    });

    const salesList = document.getElementById('sales-list');
    salesList.innerHTML = '';

    const transaction = db.transaction(['clients']);
    const objectStore = transaction.objectStore('clients');
    const request = objectStore.openCursor();

    request.onsuccess = function(event) {
        const cursor = event.target.result;
        if (cursor) {
            const listItem = document.createElement('li');
            listItem.textContent = `${cursor.value.name} - ${cursor.value.debt} - ${cursor.value.date}`;
            salesList.appendChild(listItem);
            cursor.continue();
        }
    };
}

function toggleMenu() {
    const menuContent = document.getElementById('menu-content');
    menuContent.style.display = menuContent.style.display === 'none' ? 'block' : 'none';
}
