// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAme6TMqvdAJRPTNLIJDbspBgptLT83ywk",
    authDomain: "budget-app-apha01.firebaseapp.com",
    projectId: "budget-app-apha01",
    storageBucket: "budget-app-apha01.appspot.com", // Corrected storage bucket
    messagingSenderId: "796922526923",
    appId: "1:796922526923:web:5f9f0fe3f999e77b6baf4e",
    measurementId: "G-0SXGQ2F5BQ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Export the necessary Firebase services
export { auth, db };
