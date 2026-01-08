// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const fileName = document.getElementById('fileName');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultsSection = document.getElementById('results');
const summaryDiv = document.getElementById('summary');
const tierResultsDiv = document.getElementById('tierResults');
const tiersConfigDiv = document.getElementById('tiersConfig');
const addTierBtn = document.getElementById('addTierBtn');

// State
let csvData = null;

// Default tiers
const defaultTiers = [
    { name: 'Platinum', min: 2500 },
    { name: 'Gold', min: 1000 },
    { name: 'Silver', min: 500 },
    { name: 'Bronze', min: 250 },
    { name: 'Friend', min: 50 },
];

// Color palette for tiers (cycles if more tiers than colors)
const tierColors = [
    { bg: 'linear-gradient(135deg, #e5e4e2, #a9a9a9)', text: '#333' },     // Platinum
    { bg: 'linear-gradient(135deg, #ffd700, #daa520)', text: '#333' },     // Gold
    { bg: 'linear-gradient(135deg, #c0c0c0, #a8a8a8)', text: '#333' },     // Silver
    { bg: 'linear-gradient(135deg, #cd7f32, #b87333)', text: '#fff' },     // Bronze
    { bg: 'linear-gradient(135deg, #27ae60, #2ecc71)', text: '#fff' },     // Green
    { bg: 'linear-gradient(135deg, #3498db, #2980b9)', text: '#fff' },     // Blue
    { bg: 'linear-gradient(135deg, #9b59b6, #8e44ad)', text: '#fff' },     // Purple
    { bg: 'linear-gradient(135deg, #e74c3c, #c0392b)', text: '#fff' },     // Red
    { bg: 'linear-gradient(135deg, #f39c12, #d68910)', text: '#333' },     // Orange
    { bg: 'linear-gradient(135deg, #1abc9c, #16a085)', text: '#fff' },     // Teal
];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeTiers();
});

// Event Listeners
fileInput.addEventListener('change', handleFileSelect);
analyzeBtn.addEventListener('click', analyzeData);
addTierBtn.addEventListener('click', () => addTierRow('', 0));

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
        handleFile(file);
    }
});

function initializeTiers() {
    tiersConfigDiv.innerHTML = '';
    defaultTiers.forEach(tier => addTierRow(tier.name, tier.min));
}

function addTierRow(name, min) {
    const row = document.createElement('div');
    row.className = 'tier-input';
    row.innerHTML = `
        <input type="text" class="tier-name" value="${escapeHtml(name)}" placeholder="Tier name">
        <span class="currency">$</span>
        <input type="number" class="tier-amount" value="${min}" min="0" placeholder="Min amount">
        <button type="button" class="remove-tier-btn" title="Remove tier">&times;</button>
    `;

    const removeBtn = row.querySelector('.remove-tier-btn');
    removeBtn.addEventListener('click', () => {
        row.remove();
    });

    tiersConfigDiv.appendChild(row);
}

function getTiers() {
    const tierRows = tiersConfigDiv.querySelectorAll('.tier-input');
    const tiers = [];

    tierRows.forEach((row, index) => {
        const name = row.querySelector('.tier-name').value.trim();
        const min = parseFloat(row.querySelector('.tier-amount').value) || 0;

        if (name) {
            tiers.push({
                name,
                min,
                colorIndex: index
            });
        }
    });

    // Sort by min amount descending
    tiers.sort((a, b) => b.min - a.min);

    return tiers;
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    fileName.textContent = `Selected: ${file.name}`;

    const reader = new FileReader();
    reader.onload = (e) => {
        csvData = e.target.result;
        analyzeBtn.disabled = false;
    };
    reader.readAsText(file);
}

function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                // Escaped quote
                currentField += '"';
                i++;
            } else if (char === '"') {
                // End of quoted field
                inQuotes = false;
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                // Start of quoted field
                inQuotes = true;
            } else if (char === ',') {
                // End of field
                currentRow.push(currentField);
                currentField = '';
            } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
                // End of row
                currentRow.push(currentField);
                if (currentRow.length > 1 || currentRow[0] !== '') {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentField = '';
                if (char === '\r') i++; // Skip \n in \r\n
            } else if (char !== '\r') {
                currentField += char;
            }
        }
    }

    // Don't forget the last field/row
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        if (currentRow.length > 1 || currentRow[0] !== '') {
            rows.push(currentRow);
        }
    }

    return rows;
}

function parseAmount(amountStr) {
    if (!amountStr) return 0;
    // Remove $ and commas, then parse as float
    const cleaned = amountStr.replace(/[$,]/g, '');
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}

function getColumnIndex(headers, ...possibleNames) {
    for (const name of possibleNames) {
        const index = headers.findIndex(h =>
            h.toLowerCase().trim() === name.toLowerCase()
        );
        if (index !== -1) return index;
    }
    return -1;
}

function analyzeData() {
    if (!csvData) return;

    // Get configuration
    const monthsBack = parseInt(document.getElementById('monthsBack').value) || 12;
    const tiers = getTiers();

    if (tiers.length === 0) {
        alert('Please add at least one tier');
        return;
    }

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);

    // Parse CSV
    const rows = parseCSV(csvData);
    if (rows.length < 2) {
        alert('CSV file appears to be empty or invalid');
        return;
    }

    const headers = rows[0];

    // Find column indices
    const emailIdx = getColumnIndex(headers, 'Email', 'email');
    const contactEmailIdx = getColumnIndex(headers, 'Contact Email');
    const firstNameIdx = getColumnIndex(headers, 'First Name');
    const lastNameIdx = getColumnIndex(headers, 'Last Name');
    const contactFirstIdx = getColumnIndex(headers, 'Contact First Name');
    const contactLastIdx = getColumnIndex(headers, 'Contact Last Name');
    const companyIdx = getColumnIndex(headers, 'Company', 'Contact Company Name');
    const amountIdx = getColumnIndex(headers, 'Donated', 'Amount');
    const dateIdx = getColumnIndex(headers, 'Transaction Date (UTC)', 'Transaction Date');
    const statusIdx = getColumnIndex(headers, 'Status Friendly', 'Status');

    if (amountIdx === -1) {
        alert('Could not find donation amount column');
        return;
    }

    // Aggregate donations by donor
    const donorMap = new Map();
    let totalDonations = 0;
    let transactionsInPeriod = 0;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];

        // Check status - only include succeeded transactions
        const status = statusIdx !== -1 ? (row[statusIdx] || '').toLowerCase() : '';
        if (status && status !== 'succeeded') continue;

        // Check date
        const dateStr = dateIdx !== -1 ? row[dateIdx] : '';
        const date = parseDate(dateStr);
        if (date && date < cutoffDate) continue;

        // Get amount
        const amount = parseAmount(row[amountIdx]);
        if (amount <= 0) continue;

        // Get donor identifier (email)
        let email = emailIdx !== -1 ? (row[emailIdx] || '').trim().toLowerCase() : '';
        if (!email && contactEmailIdx !== -1) {
            email = (row[contactEmailIdx] || '').trim().toLowerCase();
        }

        // Get donor name
        let firstName = firstNameIdx !== -1 ? row[firstNameIdx] : '';
        let lastName = lastNameIdx !== -1 ? row[lastNameIdx] : '';
        if (!firstName && contactFirstIdx !== -1) firstName = row[contactFirstIdx] || '';
        if (!lastName && contactLastIdx !== -1) lastName = row[contactLastIdx] || '';
        const company = companyIdx !== -1 ? row[companyIdx] : '';

        let name = `${firstName} ${lastName}`.trim();
        if (!name && company) name = company;
        if (!name) name = 'Anonymous';

        // Use email as key, fallback to name+company for anonymous
        let key = email || `anon_${name}_${company}`.toLowerCase();

        if (donorMap.has(key)) {
            const donor = donorMap.get(key);
            donor.total += amount;
            donor.transactions++;
            // Update name if we have a better one
            if (name !== 'Anonymous' && donor.name === 'Anonymous') {
                donor.name = name;
            }
        } else {
            donorMap.set(key, {
                email: email || '',
                name: name,
                total: amount,
                transactions: 1
            });
        }

        totalDonations += amount;
        transactionsInPeriod++;
    }

    // Convert to array and assign tiers
    const donors = Array.from(donorMap.values());

    // Assign tier to each donor
    const tierGroups = {};
    tiers.forEach((t, idx) => tierGroups[t.name] = { ...t, donors: [], total: 0, colorIndex: idx });
    tierGroups['Other'] = { name: 'Other', min: 0, donors: [], total: 0, colorIndex: tiers.length };

    donors.forEach(donor => {
        let assigned = false;
        for (const tier of tiers) {
            if (donor.total >= tier.min) {
                tierGroups[tier.name].donors.push(donor);
                tierGroups[tier.name].total += donor.total;
                assigned = true;
                break;
            }
        }
        if (!assigned) {
            tierGroups['Other'].donors.push(donor);
            tierGroups['Other'].total += donor.total;
        }
    });

    // Sort donors within each tier by total (descending)
    Object.values(tierGroups).forEach(group => {
        group.donors.sort((a, b) => b.total - a.total);
    });

    // Display results
    displayResults(tierGroups, tiers, {
        totalDonations,
        totalDonors: donors.length,
        transactionsInPeriod,
        monthsBack
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function getTierColor(index) {
    // Use gray for "Other" tier (last one)
    if (index >= tierColors.length) {
        return { bg: 'linear-gradient(135deg, #95a5a6, #7f8c8d)', text: '#fff' };
    }
    return tierColors[index % tierColors.length];
}

function displayResults(tierGroups, tiers, summary) {
    resultsSection.hidden = false;

    // Summary
    summaryDiv.innerHTML = `
        <div class="summary-item">
            <div class="label">Time Period</div>
            <div class="value">${summary.monthsBack} months</div>
        </div>
        <div class="summary-item">
            <div class="label">Total Donors</div>
            <div class="value">${summary.totalDonors}</div>
        </div>
        <div class="summary-item">
            <div class="label">Transactions</div>
            <div class="value">${summary.transactionsInPeriod}</div>
        </div>
        <div class="summary-item">
            <div class="label">Total Donated</div>
            <div class="value">${formatCurrency(summary.totalDonations)}</div>
        </div>
    `;

    // Tier cards
    const tierOrder = [...tiers.map(t => t.name), 'Other'];
    tierResultsDiv.innerHTML = tierOrder.map((tierName, idx) => {
        const group = tierGroups[tierName];
        if (!group) return '';

        const color = getTierColor(idx);

        const donorRows = group.donors.length > 0
            ? group.donors.map(d => `
                <tr>
                    <td>${escapeHtml(d.name)}</td>
                    <td>${escapeHtml(d.email)}</td>
                    <td class="amount">${formatCurrency(d.total)}</td>
                    <td>${d.transactions}</td>
                </tr>
            `).join('')
            : '';

        const tableContent = group.donors.length > 0
            ? `<table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Total Donated</th>
                        <th># Donations</th>
                    </tr>
                </thead>
                <tbody>${donorRows}</tbody>
            </table>`
            : '<div class="tier-empty">No donors in this tier</div>';

        return `
            <div class="tier-card">
                <div class="tier-header" style="background: ${color.bg}; color: ${color.text};" onclick="this.parentElement.classList.toggle('collapsed')">
                    <h3>${escapeHtml(group.name)}${group.min > 0 ? ` (${formatCurrency(group.min)}+)` : ''}</h3>
                    <div class="tier-stats">
                        <span>${group.donors.length} donors</span>
                        <span>${formatCurrency(group.total)}</span>
                    </div>
                </div>
                <div class="tier-body">
                    ${tableContent}
                </div>
            </div>
        `;
    }).join('');

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
