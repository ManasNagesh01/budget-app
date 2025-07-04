// Firebase services will be available via window.budgetApp.firebase
let auth, db;

// Key names for FX rate
let inrToGbpRate = 0.0095; // fallback when offline
let currentUser = null;

// DOM Elements
const appContent = document.getElementById('appContent');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const showSignupBtn = document.getElementById('showSignupBtn');
const showLoginBtn = document.getElementById('showLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authModal = new bootstrap.Modal(document.getElementById('authModal'));

// Monzo API configuration
const MONZO_CLIENT_ID = 'oauth2client_0000AvN4HB2oO1FChvDU13';
const MONZO_CLIENT_SECRET = 'mnzpub.b+MiLxCR2ZRDrlTcmAs9iOH1P/qdCpxJCp4fn95L8BsYJZb6USWhcdPTKQLRuV29Gydx2mFhbxE1uqjwlLwVxA==';
const MONZO_REDIRECT_URI = 'https://manasnagesh01.github.io/budget-app/monzo_callback.html';

// Security check - Monzo requires HTTPS
if (window.location.protocol !== 'https:') {
    console.warn('Warning: Monzo API requires HTTPS. Please serve this application over HTTPS.');
}

// Auth State Change Handler
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        currentUser = user;
        appContent.style.display = 'block';
        authModal.hide();
        // Load user data
        loadUserData();
    } else {
        // User is signed out
        currentUser = null;
        appContent.style.display = 'none';
        authModal.show();
    }
});

// Event Listeners
loginBtn.addEventListener('click', handleLogin);
signupBtn.addEventListener('click', handleSignup);
showSignupBtn.addEventListener('click', () => {
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
});
showLoginBtn.addEventListener('click', () => {
    signupForm.style.display = 'none';
    loginForm.style.display = 'block';
});
logoutBtn.addEventListener('click', () => auth.signOut());

// Auth Handlers
async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorElement = document.getElementById('loginError');
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        errorElement.textContent = '';
        return true;
    } catch (error) {
        errorElement.textContent = error.message;
        return false;
    }
}

async function handleSignup() {
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorElement = document.getElementById('signupError');
    
    if (password !== confirmPassword) {
        errorElement.textContent = 'Passwords do not match';
        return false;
    }
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        errorElement.textContent = '';
        
        // Initialize user data in Firestore
        await db.collection('users').doc(userCredential.user.uid).set({
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            dailyExpenses: [],
            monthlyExpenses: [],
            loans: [],
            loanBalances: []
        });
        return true;
    } catch (error) {
        errorElement.textContent = error.message;
        return false;
    }
}

// Data Management Functions
function getUserDocRef() {
    if (!auth.currentUser) throw new Error('User not authenticated');
    return db.collection('users').doc(auth.currentUser.uid);
}

async function loadUserData() {
    try {
        const userDoc = await getUserDocRef().get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            // Initialize your app with user data
            renderDaily(userData.dailyExpenses || []);
            renderMonthly(userData.monthlyExpenses || []);
            renderLoans(userData.loans || []);
            renderLoanBalance(userData.loanBalances || []);
        } else {
            // Initialize with empty data if no document exists
            await getUserDocRef().set({
                dailyExpenses: [],
                monthlyExpenses: [],
                loans: [],
                loanBalances: []
            });
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

async function saveUserData(data) {
    try {
        await getUserDocRef().update(data);
    } catch (error) {
        console.error('Error saving user data:', error);
    }
}

async function loadData(key) {
    try {
        const userDoc = await getUserDocRef().get();
        return userDoc.exists ? (userDoc.data()[key] || []) : [];
    } catch (error) {
        console.error('Error loading data:', error);
        return [];
    }
}

async function saveData(key, data) {
    try {
        const update = {};
        update[key] = data;
        await getUserDocRef().update(update);
        return true;
    } catch (error) {
        console.error('Error saving data:', error);
        return false;
    }
}

// FX Rate
async function fetchFxRate() {
    try {
        const res = await fetch('https://api.exchangerate.host/convert?from=INR&to=GBP');
        const data = await res.json();
        if (data && data.result) {
            inrToGbpRate = data.result;
            const rateInfo = document.getElementById('rateInfo');
            if (rateInfo) rateInfo.textContent = `Today FX: 1₹ = £${inrToGbpRate.toFixed(4)}`;
        }
    } catch (e) { 
        console.warn('FX fetch failed', e);
    }
}

// Initialize the application
async function initializeApp() {
    // Default daily date to today
    document.getElementById('dailyDate').value = new Date().toISOString().slice(0, 10);
    await fetchFxRate();
    
    // Set up form submissions
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const result = await handleLogin(email, password);
        if (!result.success) {
            alert('Login failed: ' + result.error);
        }
    });

    document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        
        const result = await handleSignup(email, password);
        if (!result.success) {
            alert('Signup failed: ' + result.error);
        }
    });

    // Logout button
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        auth.signOut();
    });

    // Toggle between login and signup forms
    document.getElementById('showSignupBtn')?.addEventListener('click', () => {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('signupForm').style.display = 'block';
    });

    document.getElementById('showLoginBtn')?.addEventListener('click', () => {
        document.getElementById('signupForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
    });

    // Set up other form submissions
    document.getElementById('dailyForm')?.addEventListener('submit', addDailyExpense);
    document.getElementById('monthlyForm')?.addEventListener('submit', addMonthlyExpense);
    document.getElementById('loanForm')?.addEventListener('submit', addLoan);
    document.getElementById('loanBalForm')?.addEventListener('submit', addLoanPayment);
    
    // Monzo connect button
    document.getElementById('connectMonzoBtn')?.addEventListener('click', connectMonzo);
    
    // Check authentication state
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            appContent.style.display = 'block';
            authModal.hide();
            await loadUserData();
            checkMonzoConnection();
        } else {
            currentUser = null;
            appContent.style.display = 'none';
            authModal.show();
            // Reset forms
            document.getElementById('loginForm').reset();
            document.getElementById('signupForm').reset();
            document.getElementById('loginForm').style.display = 'block';
            document.getElementById('signupForm').style.display = 'none';
        }
    });
}

// Wait for Firebase to be initialized
document.addEventListener('firebaseInitialized', function() {
    // Get Firebase services from the global scope
    auth = window.budgetApp.firebase.auth;
    db = window.budgetApp.firebase.db;
    
    // Now initialize the app
    initializeApp();
    
    // Hide loading message and show app content
    document.getElementById('loadingMessage').style.display = 'none';
    document.getElementById('appContent').style.display = 'block';
});

// Show loading message initially
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('loadingMessage').style.display = 'block';
});

// Monzo connection handling
const MONZO_ACCESS_TOKEN_KEY = 'monzo_access_token';
const MONZO_REFRESH_TOKEN_KEY = 'monzo_refresh_token';
const MONZO_EXPIRES_AT_KEY = 'monzo_expires_at';

async function checkMonzoConnection() {
    if (!auth.currentUser) return;
    
    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data() || {};
        const monzoData = userData.monzo || {};
        
        const connectBtn = document.getElementById('connectMonzoBtn');
        if (!connectBtn) return;
        
        if (monzoData.accessToken) {
            connectBtn.textContent = 'Connected to Monzo';
            connectBtn.className = 'btn btn-success';
            connectBtn.disabled = true;
        } else {
            connectBtn.textContent = 'Connect Monzo';
            connectBtn.className = 'btn btn-primary';
            connectBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error checking Monzo connection:', error);
    }
}

function connectMonzo() {
    if (!auth.currentUser) return;
    
    const clientId = 'YOUR_MONZO_CLIENT_ID'; // Replace with your Monzo client ID
    const redirectUri = `${window.location.origin}/callback.html`; // Must match your Monzo app settings
    const state = auth.currentUser.uid; // Use user ID as state parameter for security
    
    const authUrl = `https://auth.monzo.com/?client_id=${encodeURIComponent(clientId)}` +
                   `&redirect_uri=${encodeURIComponent(redirectUri)}` +
                   '&response_type=code' +
                   `&state=${encodeURIComponent(state)}`;
    
    window.location.href = authUrl;
}

// Handle Monzo OAuth callback
async function handleMonzoCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code && state) {
        try {
            // Verify state matches current user for security
            if (!auth.currentUser || auth.currentUser.uid !== state) {
                throw new Error('User authentication mismatch');
            }
            
            // Exchange code for tokens
            const response = await fetch('https://api.monzo.com/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    client_id: 'YOUR_MONZO_CLIENT_ID',
                    client_secret: 'YOUR_MONZO_CLIENT_SECRET',
                    redirect_uri: `${window.location.origin}/callback.html`,
                    code: code
                })
            });
            
            const data = await response.json();
            
            if (data.access_token) {
                // Save tokens to Firestore
                await db.collection('users').doc(auth.currentUser.uid).set({
                    monzo: {
                        accessToken: data.access_token,
                        refreshToken: data.refresh_token,
                        expiresAt: Date.now() + (data.expires_in * 1000),
                        lastUpdated: new Date().toISOString()
                    }
                }, { merge: true });
                
                // Update UI
                checkMonzoConnection();
                
                // Clear URL parameters without page reload
                window.history.replaceState({}, document.title, window.location.pathname);
                
                // Show success message
                alert('Successfully connected Monzo account!');
            }
        } catch (error) {
            console.error('Error during Monzo OAuth:', error);
            alert('Failed to connect Monzo account. Please try again.');
        }
    }
}

// Fetch transactions from Monzo
async function fetchMonzoTransactions() {
    if (!auth.currentUser) return [];
    
    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data() || {};
        const monzoData = userData.monzo || {};
        
        if (!monzoData.accessToken) {
            console.log('No Monzo access token found');
            return [];
        }
        
        // Check if token needs refreshing
        if (monzoData.expiresAt && monzoData.expiresAt < Date.now()) {
            await refreshMonzoToken(monzoData.refreshToken);
            return fetchMonzoTransactions(); // Retry with new token
        }
        
        // Fetch accounts to get the first account ID
        const accountsResponse = await fetch('https://api.monzo.com/accounts', {
            headers: { 'Authorization': `Bearer ${monzoData.accessToken}` }
        });
        
        if (!accountsResponse.ok) throw new Error('Failed to fetch accounts');
        
        const accounts = await accountsResponse.json();
        const account = accounts.accounts[0];
        
        if (!account) throw new Error('No accounts found');
        
        // Fetch transactions for the last 30 days
        const since = new Date();
        since.setDate(since.getDate() - 30);
        
        const transactionsResponse = await fetch(
            `https://api.monzo.com/transactions?account_id=${account.id}&since=${since.toISOString()}&expand[]=merchant`,
            { headers: { 'Authorization': `Bearer ${monzoData.accessToken}` } }
        );
        
        if (!transactionsResponse.ok) throw new Error('Failed to fetch transactions');
        
        const transactionsData = await transactionsResponse.json();
        return transactionsData.transactions || [];
        
    } catch (error) {
        console.error('Error fetching Monzo transactions:', error);
        return [];
    }
}

// Refresh Monzo access token
async function refreshMonzoToken(refreshToken) {
    if (!auth.currentUser) return;
    
    try {
        const response = await fetch('https://api.monzo.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: 'YOUR_MONZO_CLIENT_ID',
                client_secret: 'YOUR_MONZO_CLIENT_SECRET',
                refresh_token: refreshToken
            })
        });
        
        const data = await response.json();
        
        if (data.access_token) {
            // Update tokens in Firestore
            await db.collection('users').doc(auth.currentUser.uid).set({
                monzo: {
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token || refreshToken, // Use new refresh token if provided
                    expiresAt: Date.now() + (data.expires_in * 1000),
                    lastUpdated: new Date().toISOString()
                }
            }, { merge: true });
            
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error refreshing Monzo token:', error);
        return false;
    }
}


const dailyForm = document.getElementById('dailyForm');
const dailyTableBody = document.querySelector('#dailyTable tbody');

// Add daily expense
async function addDailyExpense(e) {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    const form = e.target;
    const date = form.date.value;
    const amount = parseFloat(form.dailyAmount.value);
    const note = form.dailyNote.value.trim();
    
    if (!date || isNaN(amount) || amount <= 0) return;
    
    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();
        const dailyExpenses = userData.dailyExpenses || [];
        
        // Add new expense
        dailyExpenses.push({ date, amount, note });
        
        // Save back to Firestore
        await db.collection('users').doc(auth.currentUser.uid).update({
            dailyExpenses: dailyExpenses
        });
        
        // Update UI
        renderDaily(dailyExpenses);
        renderSummary();
        form.reset();
    } catch (error) {
        console.error('Error adding daily expense:', error);
        alert('Failed to add expense. Please try again.');
    }
}

function renderDaily(expenses = []) {
    if (!Array.isArray(expenses)) {
        console.error('Expected expenses to be an array, got:', expenses);
        expenses = [];
    }
    
    dailyTableBody.innerHTML = expenses.map((item, i) => `
        <tr>
            <td>${item.date || ''}</td>
            <td>${item.note || ''}</td>
            <td>£${(item.amount || 0).toFixed(2)}</td>
            <td><button class='btn btn-sm btn-danger' data-del='daily' data-index='${i}'>&times;</button></td>
        </tr>
    `).join('');
    
    const total = expenses.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const totalSpan = document.getElementById('dailyTotal');
    if (totalSpan) {
        totalSpan.textContent = total.toFixed(2);
    }
    
    // Update today's spending if the function exists
    if (typeof renderTodaySpend === 'function') {
        renderTodaySpend();
    }
}

const monthlyForm = document.getElementById('monthlyForm');
const monthlyTableBody = document.querySelector('#monthlyTable tbody');

// Add monthly expense
async function addMonthlyExpense(e) {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    const form = e.target;
    const month = form.month.value;
    const amount = parseFloat(form.monthlyAmount.value);
    const note = form.monthlyNote.value.trim();
    
    if (!month || isNaN(amount) || amount <= 0) return;
    
    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();
        const monthlyExpenses = userData.monthlyExpenses || [];
        
        // Add new expense
        monthlyExpenses.push({ month, amount, note });
        
        // Save back to Firestore
        await db.collection('users').doc(auth.currentUser.uid).update({
            monthlyExpenses: monthlyExpenses
        });
        
        // Update UI
        renderMonthly(monthlyExpenses);
        renderSummary();
        form.reset();
    } catch (error) {
        console.error('Error adding monthly expense:', error);
        alert('Failed to add monthly expense. Please try again.');
    }
}

function renderMonthly(expenses = []) {
    if (!Array.isArray(expenses)) {
        console.error('Expected expenses to be an array, got:', expenses);
        expenses = [];
    }
    
    monthlyTableBody.innerHTML = expenses.map((item, i) => `
        <tr>
            <td>${item.month || ''}</td>
            <td>${item.note || ''}</td>
            <td>£${(item.amount || 0).toFixed(2)}</td>
            <td><button class='btn btn-sm btn-danger' data-del='monthly' data-index='${i}'>&times;</button></td>
        </tr>
    `).join('');
    
    const total = expenses.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const totalSpan = document.getElementById('monthlyTotal');
    if (totalSpan) {
        totalSpan.textContent = total.toFixed(2);
    }
}
const loanForm = document.getElementById('loanForm');
const loanTableBody = document.querySelector('#loanTable tbody');

loanForm.addEventListener('submit', addLoan);

// Add or update loan
async function addLoan(e) {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    const form = e.target;
    const name = form.loanName.value.trim();
    const amount = parseFloat(form.loanAmount.value);
    const currency = form.loanCurrency.value;
    
    if (!name || isNaN(amount) || amount <= 0) return;
    
    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();
        const loans = userData.loans || [];
        
        // Convert to GBP if needed
        let amountGBP = amount;
        if (currency === 'INR') {
            amountGBP = amount * inrToGbpRate;
        }
        
        // Check if loan exists
        const existingLoanIndex = loans.findIndex(loan => loan.name.toLowerCase() === name.toLowerCase());
        const loanData = { name, amount: amountGBP, currency, originalAmount: amount };
        
        if (existingLoanIndex >= 0) {
            // Update existing loan
            loans[existingLoanIndex] = loanData;
        } else {
            // Add new loan
            loans.push(loanData);
        }
        
        // Save back to Firestore
        await db.collection('users').doc(auth.currentUser.uid).update({
            loans: loans
        });
        
        // Update UI
        renderLoans(loans);
        renderSummary();
        form.reset();
    } catch (error) {
        console.error('Error saving loan:', error);
        alert('Failed to save loan. Please try again.');
    }
}

function renderLoans(loans = []) {
    if (!Array.isArray(loans)) {
        console.error('Expected loans to be an array, got:', loans);
        loans = [];
    }
    
    loanTableBody.innerHTML = loans.map((loan, i) => `
        <tr>
            <td>${loan.name || ''}</td>
            <td>${loan.currency || 'GBP'} ${(loan.originalAmount || 0).toFixed(2)}</td>
            <td>£${(loan.amount || 0).toFixed(2)}</td>
            <td><button class='btn btn-sm btn-danger' data-del='loan' data-index='${i}'>&times;</button></td>
        </tr>
    `).join('');
    
    const total = loans.reduce((sum, loan) => sum + (parseFloat(loan.amount) || 0), 0);
    const totalSpan = document.getElementById('loanTotal');
    if (totalSpan) {
        totalSpan.textContent = total.toFixed(2);
    }
}

// Loan Balance functionality
const loanBalForm = document.getElementById('loanBalForm');
const loanBalTableBody = document.querySelector('#loanBalTable tbody');
const loanPaySelect = document.getElementById('loanPaySelect');

// Update loan select dropdown
async function updateLoanSelect() {
    if (!auth.currentUser) return;
    
    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();
        const loans = userData.loans || [];
        
        loanPaySelect.innerHTML = '<option value="">Select a loan</option>' + 
            loans.map(loan => 
                `<option value="${loan.name}">${loan.name}</option>`
            ).join('');
    } catch (error) {
        console.error('Error updating loan select:', error);
    }
}

// Add loan payment
async function addLoanPayment(e) {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    const form = e.target;
    const loanName = loanPaySelect.value;
    const amount = parseFloat(form.loanPayAmount.value);
    const date = form.loanPayDate.value;
    
    if (!loanName || isNaN(amount) || amount <= 0 || !date) {
        alert('Please fill in all fields with valid values');
        return;
    }
    
    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();
        const loanPayments = userData.loanPayments || [];
        
        // Add new payment
        loanPayments.push({ loanName, amount, date });
        
        // Save back to Firestore
        await db.collection('users').doc(auth.currentUser.uid).update({
            loanPayments: loanPayments
        });
        
        // Update UI
        await renderLoanBalance();
        form.reset();
    } catch (error) {
        console.error('Error adding loan payment:', error);
        alert('Failed to add loan payment. Please try again.');
    }
}

// Render loan balance summary
async function renderLoanBalance() {
    if (!auth.currentUser) return;
    
    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();
        
        const loans = userData.loans || [];
        const payments = userData.loanPayments || [];
        
        const loanMap = {};
        loans.forEach(loan => {
            loanMap[loan.name] = {
                ...loan,
                paid: 0,
                payments: []
            };
        });
        
        // Process payments
        payments.forEach(payment => {
            if (loanMap[payment.loanName]) {
                loanMap[payment.loanName].paid += payment.amount;
                loanMap[payment.loanName].payments.push(payment);
            }
        });
        
        // Generate table rows
        loanBalTableBody.innerHTML = Object.values(loanMap).map(loan => {
            const remaining = Math.max(0, loan.amount - loan.paid);
            return `
                <tr>
                    <td>${loan.name || ''}</td>
                    <td>£${(loan.amount || 0).toFixed(2)}</td>
                    <td>£${(loan.paid || 0).toFixed(2)}</td>
                    <td>£${remaining.toFixed(2)}</td>
                    <td>
                        <button class='btn btn-sm btn-info view-payments' data-loan="${loan.name}">View Payments</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Add event listeners for view payments buttons
        document.querySelectorAll('.view-payments').forEach(btn => {
            btn.addEventListener('click', () => {
                const loanName = btn.dataset.loan;
                viewLoanPayments(loanName, loanMap[loanName].payments);
            });
        });
        
    } catch (error) {
        console.error('Error rendering loan balance:', error);
    }
}

// View detailed loan payments
function viewLoanPayments(loanName, payments = []) {
    const modal = new bootstrap.Modal(document.getElementById('loanPaymentsModal'));
    const modalTitle = document.getElementById('loanPaymentsModalLabel');
    const modalBody = document.getElementById('loanPaymentsModalBody');
    
    modalTitle.textContent = `Payment History: ${loanName}`;
    
    if (payments.length === 0) {
        modalBody.innerHTML = '<p>No payments found for this loan.</p>';
    } else {
        modalBody.innerHTML = `
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payments.map(payment => `
                            <tr>
                                <td>${payment.date || 'N/A'}</td>
                                <td>£${(payment.amount || 0).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    modal.show();
}

// Initialize loan balance section
if (loanBalForm) {
    loanBalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!auth.currentUser) return;
        
        const name = document.getElementById('loanBalName').value.trim();
        const principal = parseFloat(document.getElementById('loanBalPrincipal').value);
        const currency = document.getElementById('loanBalCurrency').value;
        const rate = parseFloat(document.getElementById('loanBalRate').value);
        
        if (!name || isNaN(principal) || isNaN(rate)) return;
        
        try {
            const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
            const userData = userDoc.data();
            const loans = userData.loans || [];
            
            // Create new loan object
            const loan = {
                name,
                principal,
                currency,
                rate,
                payments: []
            };
            
            // Check if loan exists
            const existingLoanIndex = loans.findIndex(l => l.name.toLowerCase() === name.toLowerCase());
            
            if (existingLoanIndex >= 0) {
                // Update existing loan
                loans[existingLoanIndex] = loan;
            } else {
                // Add new loan
                loans.push(loan);
            }
            
            // Save to Firestore
            await db.collection('users').doc(auth.currentUser.uid).update({
                loans: loans
            });
            
            // Update UI
            renderLoanBalance();
            loanBalForm.reset();
        } catch (error) {
            console.error('Error saving loan balance:', error);
            alert('Failed to save loan. Please try again.');
        }
    });
    
    // Set default date to today
    if (document.getElementById('loanPayDate')) {
        document.getElementById('loanPayDate').value = new Date().toISOString().slice(0, 10);
    }
    
    // Initial render
    updateLoanSelect();
    renderLoanBalance();
}

// Render loan balance summary
async function renderLoanBalance() {
    if (!auth.currentUser) return;
    
    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data() || {};
        const loans = userData.loans || [];
        
        // Generate table rows
        loanBalTableBody.innerHTML = loans.map((loan, i) => `
            <tr>
                <td>${loan.name || ''}</td>
                <td>${loan.currency === 'GBP' ? '£' : '₹'}</td>
                <td>${(loan.principal || 0).toFixed(2)} ${loan.currency || ''}</td>
                <td>${(loan.rate || 0).toFixed(2)}%</td>
                <td>
                    <button class='btn btn-sm btn-danger' data-del='loan' data-index='${i}'>×</button>
                    <button class='btn btn-sm btn-info ms-1' data-view-loan='${i}'>View</button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error rendering loan balance:', error);
    }
}
async function calculateTodaySpend() {
    try {
        if (!auth.currentUser) return;
        
        const todayStr = new Date().toISOString().slice(0, 10);
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data() || {};
        
        const dailyExpenses = userData.dailyExpenses || [];
        const monthlyExpenses = userData.monthlyExpenses || [];
        
        const dailyToday = dailyExpenses.filter(d => d.date === todayStr);
        const currentMonth = todayStr.slice(0, 7);
        const monthlyThisMonth = monthlyExpenses.find(m => m.month === currentMonth);
        
        const dailyTotal = dailyToday.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const monthlyTotal = monthlyThisMonth ? (parseFloat(monthlyThisMonth.amount) || 0) : 0;
        const total = dailyTotal + monthlyTotal;
        
        const totalSpan = document.getElementById('dailyTotal');
        if (totalSpan) {
            totalSpan.textContent = total.toFixed(2);
        }
        
        return total;
    } catch (error) {
        console.error('Error calculating today\'s spend:', error);
        return 0;
    }
}

// Render summary chart
async function renderSummary() {
    if (!auth.currentUser) return;
    
    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data() || {};
        
        const daily = userData.dailyExpenses || [];
        const monthly = userData.monthlyExpenses || [];
        const loans = userData.loans || [];
        
        // Fetch Monzo transactions if connected
        let monzoTransactions = [];
        if (userData.monzo && userData.monzo.accessToken) {
            monzoTransactions = await fetchMonzoTransactions();
        }
        
        // Calculate totals
        const dailyTotal = daily.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const monthlyTotal = monthly.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const loanTotal = loans.reduce((sum, loan) => sum + (parseFloat(loan.amount) || 0), 0);
        
        // Calculate Monzo spending (only include expenses, not income)
        const monzoSpending = monzoTransactions
            .filter(tx => tx.amount < 0) // Only include expenses
            .reduce((sum, tx) => sum + (Math.abs(tx.amount) / 100), 0); // Convert from pence to pounds
        
        // Update summary cards
        updateSummaryCard('dailyTotal', dailyTotal);
        updateSummaryCard('monthlyTotal', monthlyTotal);
        updateSummaryCard('loanTotal', loanTotal);
        
        // Add Monzo spending to the chart if available
        const chartData = {
            daily: dailyTotal,
            monthly: monthlyTotal,
            loans: loanTotal
        };
        
        if (monzoSpending > 0) {
            chartData.monzo = monzoSpending;
            updateSummaryCard('monzoTotal', monzoSpending);
        }
        
        // Update chart
        updateChart(chartData);
        
    } catch (error) {
        console.error('Error rendering summary:', error);
    }
}

// Update summary card with value
function updateSummaryCard(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = `£${value.toFixed(2)}`;
    }
}

// Update the chart with new data
function updateChart(data) {
    const ctx = document.getElementById('summaryChart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (window.summaryChart) {
        window.summaryChart.destroy();
    }
    
    // Prepare chart data
    const labels = Object.keys(data);
    const values = Object.values(data);
    
    // Create new chart
    window.summaryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Amount (£)',
                data: values,
                backgroundColor: [
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(255, 99, 132, 0.6)',
                    'rgba(255, 206, 86, 0.6)'
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 99, 132, 1)',
                    'rgba(255, 206, 86, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Global click handler for delete and view payments
document.addEventListener('click', async function(e) {
    // Check if this is a delete button click
    if (e.target.tagName === 'BUTTON' && e.target.hasAttribute('data-del')) {
        e.preventDefault();
        
        const type = e.target.getAttribute('data-del');
        const idx = parseInt(e.target.getAttribute('data-index'));
        const key = type === 'daily' ? 'dailyExpenses' : 
                   type === 'monthly' ? 'monthlyExpenses' :
                   type === 'loan' ? 'loans' : 'loanBalances';
        
        try {
            const data = await loadData(key);
            if (idx >= 0 && idx < data.length) {
                data.splice(idx, 1);
                await saveData(key, data);
                
                // Re-render the appropriate section
                if (type === 'daily') renderDaily(data);
                else if (type === 'monthly') renderMonthly(data);
                else if (type === 'loan') renderLoans(data);
                else if (type === 'loanbal') renderLoanBalance(data);
                
                if (typeof renderSummary === 'function') {
                    renderSummary();
                }
            }
        } catch (error) {
            console.error('Error deleting item:', error);
        }
    } 
    // Handle view loan payments button
    else if (e.target.classList.contains('view-payments')) {
        e.preventDefault();
        const loanName = e.target.getAttribute('data-loan-name');
        const loanPayments = JSON.parse(e.target.getAttribute('data-payments') || '[]');
        
        // Update loan details
        const loanNameElement = document.getElementById('loanName');
        if (loanNameElement) {
            loanNameElement.textContent = loanName;
        }
        
        // Populate history table
        const historyTableBody = document.getElementById('historyTableBody');
        if (historyTableBody) {
            if (loanPayments && loanPayments.length) {
                historyTableBody.innerHTML = loanPayments.map(payment => `
                    <tr>
                        <td>${new Date(payment.date).toLocaleDateString()}</td>
                        <td>${payment.currency === 'GBP' ? '£' : '₹'}${(payment.amount || 0).toFixed(2)}</td>
                        <td>${payment.currency || ''}</td>
                        <td>${payment.currency === 'GBP' ? '£' : '₹'}${(payment.remainingBalance || 0).toFixed(2)}</td>
                    </tr>`
                ).join('');
            } else {
                historyTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No payments found</td></tr>';
            }
        }
        
        // Show the modal
        const modalElement = document.getElementById('loanHistoryModal');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    }
});

// Chart.js global reference
let monthChartInstance = null;

// Summary calculation
const calcBtn = document.getElementById('calcSummary');
const totalSpan = document.getElementById('totalSpent');
const todaySpan = document.getElementById('todaySpent');

if (calcBtn && totalSpan && todaySpan) {
    calcBtn.addEventListener('click', async () => {
        const selectedMonth = document.getElementById('summaryMonth')?.value; // yyyy-mm
        if (!selectedMonth) return;

        try {
            // Load all necessary data
            const [dailyExpenses, monthlyExpenses, loans] = await Promise.all([
                loadData('dailyExpenses'),
                loadData('monthlyExpenses'),
                loadData('loans')
            ]);

            // Calculate daily total for selected month
            const daily = dailyExpenses
                .filter(item => item.date.startsWith(selectedMonth))
                .reduce((sum, item) => sum + item.amount, 0);

            // Monthly expense for selected month if exists
            const monthEntry = monthlyExpenses.find(m => m.month === selectedMonth);
            const monthlyAmt = monthEntry ? monthEntry.amount : 0;

            // Loans total (assumed to be monthly recurring)
            const loansTotal = loans.reduce((sum, l) => sum + l.amount, 0);

            const total = daily + monthlyAmt + loansTotal;
            totalSpan.textContent = total.toFixed(2);

            // Update today's spend
            try {
                const todaySpend = await calculateTodaySpend();
                if (todaySpan) {
                    todaySpan.textContent = todaySpend.toFixed(2);
                }
            } catch (error) {
                console.error('Error calculating today\'s spend:', error);
                if (todaySpan) {
                    todaySpan.textContent = '0.00';
                }
            }

            // Update the chart
            if (typeof renderSummary === 'function') {
                renderSummary();
            }
        } catch (error) {
            console.error('Error calculating summary:', error);
        }
    });
}
