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
const exportBtn = document.getElementById('exportBtn');
const mergeToolbar = document.getElementById('mergeToolbar');
const mergeCountSpan = document.getElementById('mergeCount');
const mergeBtn = document.getElementById('mergeBtn');
const unmergeBtn = document.getElementById('unmergeBtn');
const cancelMergeBtn = document.getElementById('cancelMergeBtn');
const helpBtn = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const closeModal = document.getElementById('closeModal');
const sampleDataBtn = document.getElementById('sampleDataBtn');

// State
let csvData = null;
let lastResults = null;
let selectedDonors = new Set(); // Set of donor keys currently selected
let mergedContacts = new Map(); // Map of secondary Contact ID -> primary Contact ID
let mergeGroups = new Map(); // Map of primary Contact ID -> Set of all Contact IDs in the group

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
exportBtn.addEventListener('click', exportResults);
mergeBtn.addEventListener('click', mergeSelectedDonors);
unmergeBtn.addEventListener('click', unmergeSelectedDonors);
cancelMergeBtn.addEventListener('click', clearSelection);

// Help Modal
helpBtn.addEventListener('click', () => {
    helpModal.hidden = false;
});

closeModal.addEventListener('click', () => {
    helpModal.hidden = true;
});

helpModal.addEventListener('click', (e) => {
    // Close when clicking outside the modal content
    if (e.target === helpModal) {
        helpModal.hidden = true;
    }
});

// Sample Data
sampleDataBtn.addEventListener('click', loadSampleData);

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

// Selection and Merge Management
function toggleDonorSelection(donorKey, contactId, isMerged, checkbox) {
    const row = checkbox.closest('tr');

    if (checkbox.checked) {
        selectedDonors.add(JSON.stringify({ key: donorKey, contactId, isMerged }));
        row.classList.add('selected');
    } else {
        selectedDonors.delete(JSON.stringify({ key: donorKey, contactId, isMerged }));
        row.classList.remove('selected');
    }

    updateMergeToolbar();
}

function updateMergeToolbar() {
    const count = selectedDonors.size;

    if (count >= 1) {
        mergeToolbar.hidden = false;
        mergeCountSpan.textContent = `${count} donor${count > 1 ? 's' : ''} selected`;

        // Check if any selected donor is merged (for unmerge button)
        const selected = Array.from(selectedDonors).map(s => JSON.parse(s));
        const hasMerged = selected.some(s => s.isMerged);
        const canMerge = count >= 2;

        mergeBtn.hidden = !canMerge;
        unmergeBtn.hidden = !hasMerged;

        // If only showing unmerge and not merge, adjust text
        if (hasMerged && !canMerge) {
            mergeCountSpan.textContent = `1 merged donor selected`;
        }
    } else {
        mergeToolbar.hidden = true;
    }
}

function clearSelection() {
    selectedDonors.clear();
    document.querySelectorAll('.donor-checkbox').forEach(cb => {
        cb.checked = false;
        const row = cb.closest('tr');
        if (row) row.classList.remove('selected');
    });
    mergeToolbar.hidden = true;
    mergeCountSpan.textContent = '0 selected';
}

function mergeSelectedDonors() {
    if (selectedDonors.size < 2) return;

    // Convert selected donors to array
    const selected = Array.from(selectedDonors).map(s => JSON.parse(s));

    // First selected donor becomes the primary
    const primary = selected[0];
    const allContactIds = new Set();

    // Collect all contact IDs (including any already merged ones)
    selected.forEach(donor => {
        if (donor.contactId) {
            // If this donor is already a merge group primary, include all its IDs
            if (mergeGroups.has(donor.contactId)) {
                mergeGroups.get(donor.contactId).forEach(id => allContactIds.add(id));
            } else {
                allContactIds.add(donor.contactId);
            }
        }
    });

    // Update mergedContacts map - all non-primary IDs point to primary
    allContactIds.forEach(id => {
        if (id !== primary.contactId) {
            mergedContacts.set(id, primary.contactId);
        }
    });

    // Update mergeGroups - primary now owns all these IDs
    mergeGroups.set(primary.contactId, allContactIds);

    // Remove old merge group entries for secondaries
    selected.slice(1).forEach(donor => {
        if (donor.contactId && mergeGroups.has(donor.contactId)) {
            mergeGroups.delete(donor.contactId);
        }
    });

    // Clear selection and re-analyze
    clearSelection();
    analyzeData();
}

function unmergeSelectedDonors() {
    const selected = Array.from(selectedDonors).map(s => JSON.parse(s));

    selected.forEach(donor => {
        if (donor.contactId && mergeGroups.has(donor.contactId)) {
            // Remove all mappings for this group
            const groupIds = mergeGroups.get(donor.contactId);
            groupIds.forEach(id => {
                mergedContacts.delete(id);
            });
            mergeGroups.delete(donor.contactId);
        }
    });

    // Clear selection and re-analyze
    clearSelection();
    analyzeData();
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

    // Clear any existing selection
    selectedDonors.clear();
    updateMergeToolbar();

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
    const contactIdIdx = getColumnIndex(headers, 'Contact ID');
    const emailIdx = getColumnIndex(headers, 'Email', 'email');
    const contactEmailIdx = getColumnIndex(headers, 'Contact Email');
    const firstNameIdx = getColumnIndex(headers, 'First Name');
    const lastNameIdx = getColumnIndex(headers, 'Last Name');
    const contactFirstIdx = getColumnIndex(headers, 'Contact First Name');
    const contactLastIdx = getColumnIndex(headers, 'Contact Last Name');
    const publicNameIdx = getColumnIndex(headers, 'Public Name');
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

        // Get Contact ID (primary identifier)
        let contactId = contactIdIdx !== -1 ? (row[contactIdIdx] || '').trim() : '';

        // Apply merged contacts - if this Contact ID should be merged into another, use that one
        const originalContactId = contactId;
        if (contactId && mergedContacts.has(contactId)) {
            contactId = mergedContacts.get(contactId);
        }

        // Get donor email
        let email = emailIdx !== -1 ? (row[emailIdx] || '').trim().toLowerCase() : '';
        if (!email && contactEmailIdx !== -1) {
            email = (row[contactEmailIdx] || '').trim().toLowerCase();
        }

        // Get donor name
        let firstName = firstNameIdx !== -1 ? row[firstNameIdx] : '';
        let lastName = lastNameIdx !== -1 ? row[lastNameIdx] : '';
        if (!firstName && contactFirstIdx !== -1) firstName = row[contactFirstIdx] || '';
        if (!lastName && contactLastIdx !== -1) lastName = row[contactLastIdx] || '';
        const publicName = publicNameIdx !== -1 ? (row[publicNameIdx] || '').trim() : '';
        const company = companyIdx !== -1 ? row[companyIdx] : '';

        let name = `${firstName} ${lastName}`.trim();
        if (!name && publicName) name = publicName;
        if (!name && company) name = company;
        if (!name) name = 'Anonymous';

        // Use Contact ID as key (after merge), fallback to email, then name+company
        let key = contactId || email || `anon_${name}_${company}`.toLowerCase();

        // Create donation record with original Contact ID and name
        const donation = {
            amount,
            date: date,
            dateStr: dateStr,
            originalContactId: originalContactId,
            name: name,
            email: email
        };

        if (donorMap.has(key)) {
            const donor = donorMap.get(key);
            donor.total += amount;
            donor.transactions++;
            donor.donations.push(donation);
            // Track all original Contact IDs
            if (originalContactId) {
                donor.allContactIds.add(originalContactId);
            }
            // Track all names (for merged donors)
            if (name && name !== 'Anonymous') {
                donor.allNames.add(name);
            }
            // Update primary name if we have a better one
            if (name !== 'Anonymous' && donor.name === 'Anonymous') {
                donor.name = name;
            }
            // Update email if we have one and donor doesn't
            if (email && !donor.email) {
                donor.email = email;
            }
        } else {
            // Check if this is a merged donor
            const isMerged = mergeGroups.has(contactId);
            const allContactIds = new Set();
            if (originalContactId) {
                allContactIds.add(originalContactId);
            }
            const allNames = new Set();
            if (name && name !== 'Anonymous') {
                allNames.add(name);
            }

            donorMap.set(key, {
                contactId: contactId || '',
                allContactIds: allContactIds,
                allNames: allNames,
                isMerged: isMerged,
                email: email || '',
                name: name,
                total: amount,
                transactions: 1,
                donations: [donation]
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

function formatDate(date) {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(date);
}

function toggleDonorDetails(donorId) {
    const detailsRow = document.getElementById(donorId);
    const parentRow = detailsRow.previousElementSibling;
    const icon = parentRow.querySelector('.expand-icon');

    if (detailsRow.style.display === 'none') {
        detailsRow.style.display = 'table-row';
        parentRow.classList.add('expanded');
        icon.innerHTML = '&#9660;'; // Down arrow
    } else {
        detailsRow.style.display = 'none';
        parentRow.classList.remove('expanded');
        icon.innerHTML = '&#9654;'; // Right arrow
    }
}

function getTierColor(index) {
    // Use gray for "Other" tier (last one)
    if (index >= tierColors.length) {
        return { bg: 'linear-gradient(135deg, #95a5a6, #7f8c8d)', text: '#fff' };
    }
    return tierColors[index % tierColors.length];
}

function displayResults(tierGroups, tiers, summary) {
    // Store results for export
    lastResults = { tierGroups, tiers, summary };

    resultsSection.hidden = false;

    // Summary
    const analysisDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    summaryDiv.innerHTML = `
        <div class="summary-item">
            <div class="label">Analysis Date</div>
            <div class="value">${analysisDate}</div>
        </div>
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
            ? group.donors.map((d, donorIdx) => {
                const hasMultiple = d.transactions > 1;
                const donorId = `donor-${idx}-${donorIdx}`;

                // Sort donations by date (newest first)
                const sortedDonations = [...d.donations].sort((a, b) => {
                    if (!a.date) return 1;
                    if (!b.date) return -1;
                    return b.date - a.date;
                });

                const detailRows = sortedDonations.map(don => `
                    <tr class="donation-detail">
                        <td></td>
                        <td class="detail-name">${escapeHtml(don.name || d.name)}</td>
                        <td class="detail-contact-id">${escapeHtml(don.originalContactId || d.contactId)}</td>
                        <td class="detail-email">${escapeHtml(don.email || d.email)}</td>
                        <td class="detail-amount">${formatCurrency(don.amount)}</td>
                        <td class="detail-date">${formatDate(don.date)}</td>
                    </tr>
                `).join('');

                const donorKey = d.contactId || d.email || d.name;
                const isMerged = d.isMerged || false;
                const allContactIdsArray = Array.from(d.allContactIds || []);
                const contactIdDisplay = allContactIdsArray.length > 1
                    ? allContactIdsArray.join(', ')
                    : (d.contactId || '');
                const allNamesArray = Array.from(d.allNames || []);
                const nameDisplay = isMerged && allNamesArray.length > 1
                    ? allNamesArray.join(', ')
                    : d.name;
                const mergedIndicator = isMerged ? '<span class="merged-indicator">MERGED</span>' : '';

                return `
                    <tr class="donor-row ${hasMultiple ? 'expandable' : ''}">
                        <td onclick="event.stopPropagation()">
                            <input type="checkbox" class="donor-checkbox"
                                   onchange="toggleDonorSelection('${escapeHtml(donorKey)}', '${escapeHtml(d.contactId)}', ${isMerged}, this)">
                        </td>
                        <td ${hasMultiple ? `onclick="toggleDonorDetails('${donorId}')"` : ''}>
                            ${hasMultiple ? '<span class="expand-icon">&#9654;</span>' : '<span class="expand-icon-placeholder"></span>'}
                            ${escapeHtml(nameDisplay)}${mergedIndicator}
                        </td>
                        <td class="contact-id">${escapeHtml(contactIdDisplay)}</td>
                        <td>${escapeHtml(d.email)}</td>
                        <td class="amount">${formatCurrency(d.total)}</td>
                        <td>${d.transactions}</td>
                    </tr>
                    ${hasMultiple ? `<tr class="donation-details-container" id="${donorId}" style="display: none;">
                        <td colspan="6">
                            <table class="donation-details-table">
                                <tbody>${detailRows}</tbody>
                            </table>
                        </td>
                    </tr>` : ''}
                `;
            }).join('')
            : '';

        const tableContent = group.donors.length > 0
            ? `<table>
                <thead>
                    <tr>
                        <th></th>
                        <th>Name</th>
                        <th>Contact ID</th>
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

function exportResults() {
    if (!lastResults) return;

    const { tierGroups, tiers, summary } = lastResults;
    const lines = [];

    // Header
    lines.push('DONOR TIER SEGMENTATION REPORT');
    lines.push('='.repeat(50));
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`Time Period: ${summary.monthsBack} months`);
    lines.push('');

    // Summary
    lines.push('SUMMARY');
    lines.push('-'.repeat(30));
    lines.push(`Total Donors: ${summary.totalDonors}`);
    lines.push(`Total Transactions: ${summary.transactionsInPeriod}`);
    lines.push(`Total Donated: ${formatCurrency(summary.totalDonations)}`);
    lines.push('');

    // Tier breakdown
    const tierOrder = [...tiers.map(t => t.name), 'Other'];
    tierOrder.forEach(tierName => {
        const group = tierGroups[tierName];
        if (!group) return;

        lines.push('');
        lines.push(`${group.name.toUpperCase()}${group.min > 0 ? ` (${formatCurrency(group.min)}+)` : ''}`);
        lines.push('-'.repeat(30));
        lines.push(`Donors: ${group.donors.length} | Total: ${formatCurrency(group.total)}`);
        lines.push('');

        if (group.donors.length > 0) {
            // Column headers
            lines.push('Name                                    Contact ID    Email                                   Total           #');
            lines.push('-'.repeat(115));

            group.donors.forEach(d => {
                const name = d.name.substring(0, 38).padEnd(40);
                const contactId = (d.contactId || '').substring(0, 10).padEnd(14);
                const email = d.email.substring(0, 38).padEnd(40);
                const total = formatCurrency(d.total).padStart(12);
                const count = d.transactions.toString().padStart(4);
                lines.push(`${name}${contactId}${email}${total}${count}`);
            });
        } else {
            lines.push('No donors in this tier');
        }
        lines.push('');
    });

    // Create and download file
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `donor-tiers-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function loadSampleData() {
    // Sample data with fake donors spanning 3 years for demonstration
    const sampleCSV = `Contact ID,First Name,Last Name,Public Name,Email,Contact Email,Company,Donated,Transaction Date (UTC),Status Friendly
10001,Sarah,Johnson,Sarah J,sarah.johnson@email.com,sarah.johnson@email.com,Johnson Family Foundation,"$3,500.00",2025-09-15,Succeeded
10001,Sarah,Johnson,Sarah J,sarah.johnson@email.com,sarah.johnson@email.com,Johnson Family Foundation,"$3,000.00",2024-09-10,Succeeded
10001,Sarah,Johnson,Sarah J,sarah.johnson@email.com,sarah.johnson@email.com,Johnson Family Foundation,"$2,500.00",2023-09-08,Succeeded
10002,Michael,Chen,Mike Chen,mchen@techcorp.com,mchen@techcorp.com,TechCorp Inc,"$2,800.00",2025-10-22,Succeeded
10002,Michael,Chen,Mike Chen,mchen@techcorp.com,mchen@techcorp.com,TechCorp Inc,"$2,500.00",2024-10-18,Succeeded
10002,Michael,Chen,Mike Chen,mchen@techcorp.com,mchen@techcorp.com,TechCorp Inc,"$2,000.00",2023-10-20,Succeeded
10003,Emily,Rodriguez,Emily R,emily.r@gmail.com,emily.r@gmail.com,,"$1,500.00",2025-08-03,Succeeded
10003,Emily,Rodriguez,Emily R,emily.r@gmail.com,emily.r@gmail.com,,"$750.00",2025-11-18,Succeeded
10003,Emily,Rodriguez,Emily R,emily.r@gmail.com,emily.r@gmail.com,,"$1,200.00",2024-08-15,Succeeded
10003,Emily,Rodriguez,Emily R,emily.r@gmail.com,emily.r@gmail.com,,"$800.00",2023-12-20,Succeeded
10004,David,Thompson,David T,david.t@outlook.com,david.t@outlook.com,Thompson & Associates,"$1,200.00",2025-07-28,Succeeded
10004,David,Thompson,David T,david.t@outlook.com,david.t@outlook.com,Thompson & Associates,"$1,000.00",2024-07-15,Succeeded
10004,David,Thompson,David T,david.t@outlook.com,david.t@outlook.com,Thompson & Associates,"$1,000.00",2023-07-22,Succeeded
10005,Jennifer,Williams,Jen Williams,jwilliams@school.edu,jwilliams@school.edu,Lincoln Elementary,"$850.00",2025-09-05,Succeeded
10005,Jennifer,Williams,Jen Williams,jwilliams@school.edu,jwilliams@school.edu,Lincoln Elementary,"$350.00",2025-12-01,Succeeded
10005,Jennifer,Williams,Jen Williams,jwilliams@school.edu,jwilliams@school.edu,Lincoln Elementary,"$500.00",2024-09-12,Succeeded
10005,Jennifer,Williams,Jen Williams,jwilliams@school.edu,jwilliams@school.edu,Lincoln Elementary,"$400.00",2023-09-18,Succeeded
10006,Robert,Garcia,Bob Garcia,rgarcia@email.com,rgarcia@email.com,,"$600.00",2025-10-10,Succeeded
10006,Robert,Garcia,Bob Garcia,rgarcia@email.com,rgarcia@email.com,,"$500.00",2024-10-05,Succeeded
10006,Robert,Garcia,Bob Garcia,rgarcia@email.com,rgarcia@email.com,,"$400.00",2023-10-12,Succeeded
10007,Amanda,Lee,Amanda L,alee@nonprofit.org,alee@nonprofit.org,Community Helpers,"$500.00",2025-08-22,Succeeded
10007,Amanda,Lee,Amanda L,alee@nonprofit.org,alee@nonprofit.org,Community Helpers,"$500.00",2024-08-20,Succeeded
10007,Amanda,Lee,Amanda L,alee@nonprofit.org,alee@nonprofit.org,Community Helpers,"$500.00",2023-08-25,Succeeded
10008,Christopher,Brown,Chris B,cbrown@company.com,cbrown@company.com,Brown Industries,"$450.00",2025-11-05,Succeeded
10008,Christopher,Brown,Chris B,cbrown@company.com,cbrown@company.com,Brown Industries,"$400.00",2024-11-10,Succeeded
10009,Jessica,Martinez,Jess M,jmartinez@email.com,jmartinez@email.com,,"$350.00",2025-09-30,Succeeded
10009,Jessica,Martinez,Jess M,jmartinez@email.com,jmartinez@email.com,,"$300.00",2024-09-28,Succeeded
10009,Jessica,Martinez,Jess M,jmartinez@email.com,jmartinez@email.com,,"$250.00",2023-09-25,Succeeded
10010,Daniel,Wilson,Dan Wilson,dwilson@email.com,dwilson@email.com,Wilson Family,"$300.00",2025-10-15,Succeeded
10010,Daniel,Wilson,Dan Wilson,dwilson@email.com,dwilson@email.com,Wilson Family,"$150.00",2025-12-20,Succeeded
10010,Daniel,Wilson,Dan Wilson,dwilson@email.com,dwilson@email.com,Wilson Family,"$250.00",2024-10-18,Succeeded
10010,Daniel,Wilson,Dan Wilson,dwilson@email.com,dwilson@email.com,Wilson Family,"$200.00",2023-10-22,Succeeded
10011,Michelle,Taylor,Michelle T,mtaylor@school.edu,mtaylor@school.edu,Oak Street School,"$275.00",2025-08-18,Succeeded
10011,Michelle,Taylor,Michelle T,mtaylor@school.edu,mtaylor@school.edu,Oak Street School,"$250.00",2024-08-22,Succeeded
10011,Michelle,Taylor,Michelle T,mtaylor@school.edu,mtaylor@school.edu,Oak Street School,"$200.00",2023-08-15,Succeeded
10012,Kevin,Anderson,Kevin A,kanderson@email.com,kanderson@email.com,,"$250.00",2025-11-12,Succeeded
10012,Kevin,Anderson,Kevin A,kanderson@email.com,kanderson@email.com,,"$200.00",2024-11-08,Succeeded
10013,Laura,Thomas,Laura T,lthomas@email.com,lthomas@email.com,,"$200.00",2025-09-08,Succeeded
10013,Laura,Thomas,Laura T,lthomas@email.com,lthomas@email.com,,"$150.00",2024-09-12,Succeeded
10013,Laura,Thomas,Laura T,lthomas@email.com,lthomas@email.com,,"$100.00",2023-09-05,Succeeded
10014,Brian,Jackson,Brian J,bjackson@company.com,bjackson@company.com,Jackson LLC,"$175.00",2025-10-25,Succeeded
10014,Brian,Jackson,Brian J,bjackson@company.com,bjackson@company.com,Jackson LLC,"$150.00",2024-10-28,Succeeded
10015,Nicole,White,Nicole W,nwhite@email.com,nwhite@email.com,,"$150.00",2025-07-15,Succeeded
10015,Nicole,White,Nicole W,nwhite@email.com,nwhite@email.com,,"$100.00",2024-07-20,Succeeded
10015,Nicole,White,Nicole W,nwhite@email.com,nwhite@email.com,,"$100.00",2023-07-18,Succeeded
10016,Steven,Harris,Steve H,sharris@email.com,sharris@email.com,,"$125.00",2025-12-05,Succeeded
10016,Steven,Harris,Steve H,sharris@email.com,sharris@email.com,,"$100.00",2024-12-10,Succeeded
10017,Rachel,Martin,Rachel M,rmartin@school.edu,rmartin@school.edu,Sunrise Academy,"$100.00",2025-08-30,Succeeded
10017,Rachel,Martin,Rachel M,rmartin@school.edu,rmartin@school.edu,Sunrise Academy,"$50.00",2025-11-28,Succeeded
10017,Rachel,Martin,Rachel M,rmartin@school.edu,rmartin@school.edu,Sunrise Academy,"$75.00",2024-08-25,Succeeded
10017,Rachel,Martin,Rachel M,rmartin@school.edu,rmartin@school.edu,Sunrise Academy,"$50.00",2023-08-20,Succeeded
10018,Andrew,Clark,Andrew C,aclark@email.com,aclark@email.com,,"$75.00",2025-09-20,Succeeded
10018,Andrew,Clark,Andrew C,aclark@email.com,aclark@email.com,,"$50.00",2024-09-15,Succeeded
10019,Stephanie,Lewis,Steph L,slewis@email.com,slewis@email.com,,"$60.00",2025-10-08,Succeeded
10019,Stephanie,Lewis,Steph L,slewis@email.com,slewis@email.com,,"$50.00",2024-10-12,Succeeded
10020,Jason,Walker,Jason W,jwalker@email.com,jwalker@email.com,,"$50.00",2025-11-01,Succeeded
10020,Jason,Walker,Jason W,jwalker@email.com,jwalker@email.com,,"$50.00",2024-11-05,Succeeded
10020,Jason,Walker,Jason W,jwalker@email.com,jwalker@email.com,,"$25.00",2023-11-10,Succeeded
10021,Melissa,Hall,Melissa H,mhall@email.com,mhall@email.com,,"$25.00",2025-12-10,Succeeded
10021,Melissa,Hall,Melissa H,mhall@email.com,mhall@email.com,,"$25.00",2024-12-15,Succeeded
10022,,,Anonymous Donor,anonymous@private.com,anonymous@private.com,,"$5,000.00",2025-10-01,Succeeded
10022,,,Anonymous Donor,anonymous@private.com,anonymous@private.com,,"$5,000.00",2024-10-05,Succeeded
10022,,,Anonymous Donor,anonymous@private.com,anonymous@private.com,,"$5,000.00",2023-10-08,Succeeded
10023,Patricia,Moore,Pat Moore,pmoore@email.com,pmoore@email.com,Moore Foundation,"$1,500.00",2024-03-15,Succeeded
10023,Patricia,Moore,Pat Moore,pmoore@email.com,pmoore@email.com,Moore Foundation,"$1,200.00",2023-03-20,Succeeded
10024,Gregory,Scott,Greg S,gscott@business.com,gscott@business.com,Scott Enterprises,"$800.00",2024-06-10,Succeeded
10024,Gregory,Scott,Greg S,gscott@business.com,gscott@business.com,Scott Enterprises,"$600.00",2023-06-15,Succeeded
10025,Catherine,Young,Cathy Y,cyoung@email.com,cyoung@email.com,,"$500.00",2024-04-22,Succeeded
10025,Catherine,Young,Cathy Y,cyoung@email.com,cyoung@email.com,,"$400.00",2023-04-18,Succeeded
10026,William,King,Bill King,wking@company.com,wking@company.com,King Industries,"$350.00",2024-05-08,Succeeded
10026,William,King,Bill King,wking@company.com,wking@company.com,King Industries,"$300.00",2023-05-12,Succeeded
10027,Elizabeth,Wright,Liz W,ewright@email.com,ewright@email.com,,"$200.00",2024-02-28,Succeeded
10027,Elizabeth,Wright,Liz W,ewright@email.com,ewright@email.com,,"$150.00",2023-02-25,Succeeded
10028,Thomas,Hill,Tom Hill,thill@school.edu,thill@school.edu,Westside Elementary,"$100.00",2024-01-15,Succeeded
10028,Thomas,Hill,Tom Hill,thill@school.edu,thill@school.edu,Westside Elementary,"$75.00",2023-01-20,Succeeded
10029,Margaret,Green,Maggie G,mgreen@email.com,mgreen@email.com,,"$50.00",2024-11-30,Succeeded
10029,Margaret,Green,Maggie G,mgreen@email.com,mgreen@email.com,,"$50.00",2023-11-25,Succeeded
10030,Richard,Adams,Rick Adams,radams@nonprofit.org,radams@nonprofit.org,Adams Family Trust,"$2,000.00",2023-12-01,Succeeded`;

    csvData = sampleCSV;
    fileName.textContent = 'Loaded: Sample Data (3 years, 30 donors)';
    analyzeBtn.disabled = false;

    // Auto-analyze to show results immediately
    analyzeData();
}
