// Check if firebase is loaded
if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded');
    if (document && document.getElementById('loadingMessage')) {
        document.getElementById('loadingMessage').innerHTML = 
            '<div class="alert alert-danger">Firebase SDK not loaded. Please check your internet connection.</div>';
    }
} else {
    // Your web app's Firebase configuration
    const firebaseConfig = {
        apiKey: "AIzaSyAme6TMqvdAJRPTNLIJDbspBgptLT83ywk",
        authDomain: "budget-app-apha01.firebaseapp.com",
        projectId: "budget-app-apha01",
        storageBucket: "budget-app-apha01.appspot.com",
        messagingSenderId: "796922526923",
        appId: "1:796922526923:web:5f9f0fe3f999e77b6baf4e",
        measurementId: "G-0SXGQ2F5BQ"
    };

    try {
        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase initialized successfully');
        
        // Initialize Firebase services
        const auth = firebase.auth();
        const db = firebase.firestore();
        
        // Make them globally available for app.js
        window.budgetApp = window.budgetApp || {};
        window.budgetApp.firebase = { 
            auth: auth, 
            db: db 
        };
        
        // Dispatch event that firebase is ready
        if (document) {
            const event = new Event('firebaseInitialized');
            document.dispatchEvent(event);
        }
        
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        if (document && document.getElementById('loadingMessage')) {
            document.getElementById('loadingMessage').innerHTML = 
                '<div class="alert alert-danger">Error initializing Firebase: ' + error.message + '</div>';
        }
    }
}
