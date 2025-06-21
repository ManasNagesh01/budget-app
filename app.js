// Key names for localStorage and FX rate
let inrToGbpRate = 0.0095; // fallback when offline
const DAILY_KEY = 'budget_daily';
const MONTHLY_KEY = 'budget_monthly';
const LOAN_KEY = 'budget_loans';
const LOAN_BAL_KEY = 'budget_loan_balance';
const MONZO_ACCESS_TOKEN_KEY = 'monzo_access_token';
const MONZO_REFRESH_TOKEN_KEY = 'monzo_refresh_token';
const MONZO_EXPIRES_AT_KEY = 'monzo_expires_at';

// Monzo API configuration
const MONZO_CLIENT_ID = 'oauth2client_0000AvN4HB2oO1FChvDU13';
const MONZO_CLIENT_SECRET = 'mnzpub.b+MiLxCR2ZRDrlTcmAs9iOH1P/qdCpxJCp4fn95L8BsYJZb6USWhcdPTKQLRuV29Gydx2mFhbxE1uqjwlLwVxA==';
const MONZO_REDIRECT_URI = 'https://manasnagesh01.github.io/budget-app/monzo_callback.html';

// Security check - Monzo requires HTTPS
if (window.location.protocol !== 'https:') {
    console.warn('Warning: Monzo API requires HTTPS. Please serve this application over HTTPS.');
}

// Utility to get parsed data or default []
function load(key) {
    return JSON.parse(localStorage.getItem(key) || '[]');
}
function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// Populate tables on load
async function fetchFxRate() {
    try {
        const res = await fetch('https://api.exchangerate.host/convert?from=INR&to=GBP');
        const data = await res.json();
        if (data && data.result) {
            inrToGbpRate = data.result;
            const rateInfo = document.getElementById('rateInfo');
            if (rateInfo) rateInfo.textContent = `Today FX: 1₹ = £${inrToGbpRate.toFixed(4)}`;
        }
    } catch (e) { console.warn('FX fetch failed', e); }
}

window.addEventListener('DOMContentLoaded', async () => {
    // Default daily date to today
    document.getElementById('dailyDate').value = new Date().toISOString().slice(0, 10);
    await fetchFxRate();
    checkMonzoConnection();
    renderDaily();
    renderMonthly();
    renderLoans();
    renderLoanBalance();
});

// Monzo connection handling
function checkMonzoConnection() {
    const statusText = document.getElementById('monzoStatusText');
    const statusDiv = document.getElementById('monzoStatus');
    
    const accessToken = localStorage.getItem(MONZO_ACCESS_TOKEN_KEY);
    const expiresAt = parseInt(localStorage.getItem(MONZO_EXPIRES_AT_KEY) || '0');
    
    if (accessToken && expiresAt > Date.now()) {
        statusText.textContent = 'Connected';
        statusDiv.classList.remove('d-none');
        statusDiv.classList.add('alert-success');
        fetchMonzoTransactions();
    } else {
        statusText.textContent = 'Not connected';
        statusDiv.classList.remove('alert-success');
        statusDiv.classList.add('d-none');
    }
}

const monzoConnectBtn = document.getElementById('monzoConnect');
if (monzoConnectBtn) {
    monzoConnectBtn.addEventListener('click', async () => {
        const authUrl = `https://auth.monzo.com/?client_id=${MONZO_CLIENT_ID}&redirect_uri=${encodeURIComponent(MONZO_REDIRECT_URI)}&response_type=code&state=${Math.random().toString(36).substring(2)}`;
        window.location.href = authUrl;
    });
}

// Handle Monzo OAuth callback
async function handleMonzoCallback(code) {
    try {
        const response = await fetch('https://api.monzo.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: MONZO_CLIENT_ID,
                client_secret: MONZO_CLIENT_SECRET,
                redirect_uri: MONZO_REDIRECT_URI,
                code: code
            })
        });
        
        const data = await response.json();
        
        // Save tokens
        localStorage.setItem(MONZO_ACCESS_TOKEN_KEY, data.access_token);
        localStorage.setItem(MONZO_REFRESH_TOKEN_KEY, data.refresh_token);
        localStorage.setItem(MONZO_EXPIRES_AT_KEY, (Date.now() + (data.expires_in * 1000)).toString());
        
        // Fetch accounts and transactions
        fetchMonzoAccounts();
        checkMonzoConnection();
    } catch (error) {
        console.error('Error handling Monzo callback:', error);
    }
}

async function fetchMonzoAccounts() {
    try {
        const response = await fetch('https://api.monzo.com/accounts', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem(MONZO_ACCESS_TOKEN_KEY)}`
            }
        });
        
        const data = await response.json();
        await fetchMonzoTransactions(data.accounts[0].id);
    } catch (error) {
        console.error('Error fetching Monzo accounts:', error);
    }
}

async function fetchMonzoTransactions(accountId) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`https://api.monzo.com/transactions?account_id=${accountId}&since=${today}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem(MONZO_ACCESS_TOKEN_KEY)}`
            }
        });
        
        const data = await response.json();
        
        // Process transactions
        const dailyData = load(DAILY_KEY);
        
        data.transactions.forEach(transaction => {
            if (transaction.amount < 0) { // Only process expenses
                const existing = dailyData.find(d => 
                    d.note === transaction.merchant?.name || transaction.description &&
                    d.amount === -transaction.amount / 100
                );
                
                if (!existing) {
                    dailyData.push({
                        date: transaction.created.split('T')[0],
                        note: transaction.merchant?.name || transaction.description,
                        amount: -transaction.amount / 100
                    });
                }
            }
        });
        
        save(DAILY_KEY, dailyData);
        renderDaily();
    } catch (error) {
        console.error('Error fetching Monzo transactions:', error);
    }
}

// Daily expenses
const dailyForm = document.getElementById('dailyForm');
const dailyTableBody = document.querySelector('#dailyTable tbody');

dailyForm.addEventListener('submit', e => {
    e.preventDefault();
    const date = document.getElementById('dailyDate').value;
    const amount = parseFloat(document.getElementById('dailyAmount').value);
    const note = document.getElementById('dailyNote').value.trim();
    if (!date || isNaN(amount) || !note) return;
    const data = load(DAILY_KEY);
    data.push({ date, note, amount });
    save(DAILY_KEY, data);
    dailyForm.reset();
    renderDaily();
});

function renderDaily() {
    const data = load(DAILY_KEY);
    dailyTableBody.innerHTML = data.map((item,i) => `<tr><td>${item.date}</td><td>${item.note}</td><td>£${item.amount.toFixed(2)}</td><td><button class='btn btn-sm btn-danger' data-del='daily' data-index='${i}'>&times;</button></td></tr>`).join('');
    const tot = data.reduce((s,i)=>s+i.amount,0);
    const span = document.getElementById('dailyTotal');
    if(span) span.textContent = tot.toFixed(2);
}

// Monthly expenses
const monthlyForm = document.getElementById('monthlyForm');
const monthlyTableBody = document.querySelector('#monthlyTable tbody');

monthlyForm.addEventListener('submit', e => {
    e.preventDefault();
    const month = document.getElementById('monthlyMonth').value; // yyyy-mm
    const amount = parseFloat(document.getElementById('monthlyAmount').value);
    const currency = document.getElementById('monthlyCurrency').value;
    if (!month || isNaN(amount)) return;
    const data = load(MONTHLY_KEY);
    // If month exists, overwrite amount
    let amountGBP = amount;
    if (currency === 'INR') amountGBP = amount * inrToGbpRate;
    const idx = data.findIndex(m => m.month === month);
    if (idx >= 0) data[idx].amount = amountGBP; else data.push({ month, amount: amountGBP });
    save(MONTHLY_KEY, data);
    monthlyForm.reset();
    renderMonthly();
});

function renderMonthly() {
    const data = load(MONTHLY_KEY);
    monthlyTableBody.innerHTML = data.map((item,i) => `<tr><td>${item.month}</td><td>£${item.amount.toFixed(2)}</td><td><button class='btn btn-sm btn-danger' data-del='monthly' data-index='${i}'>&times;</button></td></tr>`).join('');
    const tot = data.reduce((s,i)=>s+i.amount,0);
    const span = document.getElementById('monthlyTotal');
    if(span) span.textContent = tot.toFixed(2);
    renderTodaySpend();
}

// Loans / EMI
const loanForm = document.getElementById('loanForm');
const loanTableBody = document.querySelector('#loanTable tbody');

loanForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('loanName').value.trim();
    const amount = parseFloat(document.getElementById('loanAmount').value);
    const currency = document.getElementById('loanCurrency').value;
    if (!name || isNaN(amount)) return;
    const data = load(LOAN_KEY);
    // If name exists overwrite
    const idx = data.findIndex(l => l.name.toLowerCase() === name.toLowerCase());
    let amountGBP = amount;
    if (currency === 'INR') amountGBP = amount * inrToGbpRate;
    if (idx >= 0) data[idx].amount = amountGBP; else data.push({ name, amount: amountGBP });
    save(LOAN_KEY, data);
    loanForm.reset();
    renderLoans();
});

function renderLoans() {
    const data = load(LOAN_KEY);
    loanTableBody.innerHTML = data.map((item,i) => `<tr><td>${item.name}</td><td>£${item.amount.toFixed(2)}</td><td><button class='btn btn-sm btn-danger' data-del='loan' data-index='${i}'>&times;</button></td></tr>`).join('');
    const tot = data.reduce((s,i)=>s+i.amount,0);
    const span = document.getElementById('loanTotal');
    if(span) span.textContent = tot.toFixed(2);
    renderTodaySpend();
}

// Loan Balance logic
const loanBalForm = document.getElementById('loanBalForm');
const loanBalTableBody = document.querySelector('#loanBalTable tbody');
const loanPayForm = document.getElementById('loanPayForm');
const loanPaySelect = document.getElementById('loanPaySelect');

if(loanBalForm){
    loanBalForm.addEventListener('submit',e=>{
        e.preventDefault();
        const name=document.getElementById('loanBalName').value.trim();
        const principal=parseFloat(document.getElementById('loanBalPrincipal').value);
        const currency=document.getElementById('loanBalCurrency').value;
        const rate=parseFloat(document.getElementById('loanBalRate').value);
        if(!name||isNaN(principal)||isNaN(rate)) return;
        const data=load(LOAN_BAL_KEY);
        const idx=data.findIndex(l=>l.name.toLowerCase()===name.toLowerCase());
        
        // Create new loan object with all required fields
        const loan = {
            name,
            principal,
            currency,
            rate,
            payments: []
        };
        
        if(idx >= 0) {
            // Update existing loan
            data[idx] = loan;
        } else {
            // Add new loan
            data.push(loan);
        }
        
        save(LOAN_BAL_KEY, data);
        loanBalForm.reset();
        renderLoanBalance();
    });
}
if(loanPayForm){
    loanPayForm.addEventListener('submit',e=>{
        e.preventDefault();
        const idx=parseInt(loanPaySelect.value,10);
        const payAmt=parseFloat(document.getElementById('loanPayAmount').value);
        const payDate=document.getElementById('loanPayDate').value;
        const currency=document.getElementById('loanPayCurrency').value;
        const data=load(LOAN_BAL_KEY);
        if(idx>=0&&idx<data.length&&!isNaN(payAmt)&&payDate){
            // Update loan principal and add payment
            data[idx].principal=Math.max(0,data[idx].principal-payAmt);
            if(!data[idx].payments) data[idx].payments=[];
            data[idx].payments.push({date:payDate,amount:payAmt,currency});
            save(LOAN_BAL_KEY,data);
            loanPayForm.reset();
            renderLoanBalance();
        }
    });
}

function renderLoanBalance(){
    const data=load(LOAN_BAL_KEY);
    loanBalTableBody.innerHTML=data.map((l,i)=>`<tr><td>${l.name}</td><td>${l.currency==='GBP'?'£':'₹'}</td><td>${l.principal.toFixed(2)} ${l.currency}</td><td>${l.rate.toFixed(2)}</td><td><button class='btn btn-sm btn-danger' data-del='loanbal' data-index='${i}'>&times;</button><button class='btn btn-sm btn-secondary ms-1' data-view='loanbal' data-index='${i}'>History</button></td></tr>`).join('');
    loanPaySelect.innerHTML=data.map((l,i)=>`<option value='${i}'>${l.name} (Remaining £${l.principal.toFixed(2)})</option>`).join('');
}

// ---- Today Spend helpers ----
function calculateTodaySpend() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const daily = load(DAILY_KEY);
    const dailyToday = daily.filter(d => d.date === todayStr);
    const monthly = load(MONTHLY_KEY);
    const currentMonth = todayStr.slice(0, 7);
    const monthlyThisMonth = monthly.find(m => m.month === currentMonth);
    const dailyTotal = dailyToday.reduce((s, d) => s + d.amount, 0);
    const monthlyTotal = monthlyThisMonth ? monthlyThisMonth.amount : 0;
    const total = dailyTotal + monthlyTotal;
    const totalSpan = document.getElementById('dailyTotal');
    if(totalSpan) totalSpan.textContent = total.toFixed(2);
}

// Global delete handler
document.addEventListener('click', function(e){
    const view=e.target.closest('[data-view]');
    if(view){
        const idx=parseInt(view.dataset.index,10);
        const data=load(LOAN_BAL_KEY);
        const loan=data[idx];
        if(!loan) return;
        
        // Show modal with loan history
        const modal = new bootstrap.Modal(document.getElementById('loanHistoryModal'));
        
        // Update loan details
        document.getElementById('loanName').textContent = loan.name;
        document.getElementById('initialPrincipal').textContent = `${loan.currency==='GBP'?'£':'₹'}${loan.principal.toFixed(2)}`;
        document.getElementById('interestRate').textContent = `${loan.rate.toFixed(2)}%`;
        document.getElementById('remainingPrincipal').textContent = `${loan.currency==='GBP'?'£':'₹'}${loan.principal.toFixed(2)}`;
        
        // Calculate total payments
        const totalPayments = loan.payments ? loan.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
        document.getElementById('totalPayments').textContent = `${loan.currency==='GBP'?'£':'₹'}${totalPayments.toFixed(2)}`;
        
        // Populate history table
        const historyTableBody = document.getElementById('historyTableBody');
        if(loan.payments && loan.payments.length) {
            historyTableBody.innerHTML = loan.payments.map(p => `
                <tr>
                    <td>${new Date(p.date).toLocaleDateString()}</td>
                    <td>${p.currency==='GBP'?'£':'₹'}${p.amount.toFixed(2)}</td>
                    <td>${p.currency}</td>
                    <td>${loan.currency==='GBP'?'£':'₹'}${(loan.principal + p.amount).toFixed(2)}</td>
                </tr>
            `).join('');
        } else {
            historyTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No payments yet</td></tr>';
        }
        
        modal.show();
        return;
    }
    const btn = e.target.closest('[data-del]');
    if(!btn) return;
    const type = btn.dataset.del;
    const idx = parseInt(btn.dataset.index,10);
    const key = type==='daily'?DAILY_KEY:(type==='monthly'?MONTHLY_KEY:(type==='loanbal'?LOAN_BAL_KEY:LOAN_KEY));
        if(type==='loanbal') {
            const data = load(key);
            const idx = parseInt(btn.dataset.index,10);
            if(idx>=0 && idx < data.length) {
                data.splice(idx,1);
                save(key, data);
                renderLoanBalance();
            }
            return;
        }
    const arr = load(key);
    if(idx>=0 && idx < arr.length){
        arr.splice(idx,1);
        save(key, arr);
        if(type==='daily') renderDaily();
        else if(type==='monthly') renderMonthly();
        else renderLoans();
    }
});
 
 function renderTotals(){
    renderDaily();
    renderMonthly();
    renderLoans();
}

// Removed renderTodaySpend as it's no longer needed

// Chart.js global ref
let monthChartInstance;

// Summary calculation
const calcBtn = document.getElementById('calcSummary');
const totalSpan = document.getElementById('totalSpent');
const todaySpan = document.getElementById('todaySpent');

calcBtn.addEventListener('click', () => {
    const selectedMonth = document.getElementById('summaryMonth').value; // yyyy-mm
    if (!selectedMonth) return;

    // Daily total for selected month
    const daily = load(DAILY_KEY)
        .filter(item => item.date.startsWith(selectedMonth))
        .reduce((sum, item) => sum + item.amount, 0);

    // Monthly expense for selected month if exists
    const monthlyData = load(MONTHLY_KEY);
    const monthEntry = monthlyData.find(m => m.month === selectedMonth);
    const monthlyAmt = monthEntry ? monthEntry.amount : 0;

    // Loans total (assumed to be monthly recurring)
    const loansTotal = load(LOAN_KEY).reduce((sum, l) => sum + l.amount, 0);

    const total = daily + monthlyAmt + loansTotal;
    totalSpan.textContent = total.toFixed(2);

    buildMonthChart();
});
