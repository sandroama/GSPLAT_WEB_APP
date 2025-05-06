import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, doc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore'; // Changed addDoc to setDoc
import { ref, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import React, { useState, useEffect, useMemo } from 'react';

import { auth, db, storage } from '../firebase-config'; // Import Firebase services

// Updated interface to match Firestore data structure
interface FirestoreModel {
    id: string; // Firestore document ID
    fileName: string;
    downloadURL: string;
    uploadedAt?: any; // Keep timestamp if needed for sorting
    // Add other fields if necessary (e.g., originalName, size)
}

type Theme = 'light' | 'dark';

const DashboardPage: React.FC = () => {
    // Corrected state initialization
    const [models, setModels] = useState<FirestoreModel[]>([]); // Use FirestoreModel
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
        // Initialize theme from localStorage or default to 'light'
        return (localStorage.getItem('userTheme') as Theme) || 'light';
    });

    // Apply theme class to body
    useEffect(() => {
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${currentTheme}`);
        localStorage.setItem('userTheme', currentTheme);
    }, [currentTheme]);

    // Fetch models from Firestore for the current user
    useEffect(() => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            // This should ideally not happen if routing in index.tsx is correct,
            // but handle it defensively.
            console.log('No user found in Dashboard, redirecting to login.');
            window.location.hash = '#/login';
            return;
        }

        setIsLoading(true);
        // Query the 'models' subcollection within the specific user's document
        const modelsCollectionRef = collection(db, 'users', currentUser.uid, 'models');
        const q = query(
            modelsCollectionRef,
            // No need for where('userId', ...) as we are already in the user's subcollection
            orderBy('uploadedAt', 'desc') // Order by upload time, newest first
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const fetchedModels: FirestoreModel[] = [];
            querySnapshot.forEach((doc) => {
                fetchedModels.push({ id: doc.id, ...doc.data() } as FirestoreModel);
            });
            setModels(fetchedModels);
            setIsLoading(false);
            console.log('Fetched models from Firestore:', fetchedModels);
        }, (error) => {
            console.error('Error fetching models from Firestore:', error);
            setIsLoading(false);
            // TODO: Show error message to user
        });

        // Cleanup listener on unmount
        return () => unsubscribe();
    }, []); // Run only on mount (or when auth.currentUser changes if needed, but index.tsx handles login state)


    const handleModelSelect = (model: FirestoreModel) => {
        // Use downloadURL from Firestore data
        localStorage.setItem('currentModelUrl', model.downloadURL);
        localStorage.setItem('currentModelName', model.fileName);
        window.location.hash = '#/viewer';
    };

    const handleRemoveModel = async (modelToRemove: FirestoreModel) => {
        if (!auth.currentUser) return; // Should not happen, but check anyway

        console.log(`Attempting to remove model: ${modelToRemove.fileName} (ID: ${modelToRemove.id})`);

        // 1. Delete Firestore document from the user's 'models' subcollection
        try {
            const docRef = doc(db, 'users', auth.currentUser.uid, 'models', modelToRemove.id);
            await deleteDoc(docRef);
            console.log(`Firestore document users/${auth.currentUser.uid}/models/${modelToRemove.id} deleted.`);

            // 2. Delete file from Storage using the new path structure
            // We use the model ID as the folder name now
            const storagePath = `users/${auth.currentUser.uid}/models/${modelToRemove.id}/${modelToRemove.fileName}`;
            const storageRef = ref(storage, storagePath);
            await deleteObject(storageRef);
            console.log(`Storage file ${storagePath} deleted.`);

            // State update will happen automatically via the onSnapshot listener

            // Clear localStorage if it was the current model
            if (localStorage.getItem('currentModelName') === modelToRemove.fileName) {
                localStorage.removeItem('currentModelUrl');
                localStorage.removeItem('currentModelName');
            }

        } catch (error) {
            console.error(`Error removing model ${modelToRemove.fileName}:`, error);
            // TODO: Show error to user
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            // No need to manually clear localStorage items related to models here,
            // as the auth state change listener in index.tsx will redirect to login.
            // Clear theme preference if desired, or leave it.
            // localStorage.removeItem('userTheme');
            console.log('User signed out successfully.');
            // Redirect is handled by onAuthStateChanged in index.tsx
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    // Handler for the dashboard file input upload
    const handleDashboardUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        const currentUser = auth.currentUser;

        if (file && currentUser && file.name.toLowerCase().endsWith('.ply')) {
            const filename = file.name; // Use original filename

            // Generate a unique ID for the model document and storage folder
            const newModelDocRef = doc(collection(db, 'users', currentUser.uid, 'models'));
            const newModelId = newModelDocRef.id;

            const storagePath = `users/${currentUser.uid}/models/${newModelId}/${filename}`;
            const storageRef = ref(storage, storagePath);

            console.log(`Uploading ${filename} via dashboard button to ${storagePath}...`);
            // TODO: Add UI feedback for upload progress/completion/error

            try {
                // Upload file
                const snapshot = await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(snapshot.ref);
                console.log(`Successfully uploaded ${filename}. URL: ${downloadURL}`);

                // Add metadata to Firestore using setDoc with the generated ID
                await setDoc(newModelDocRef, { // Use setDoc with the pre-generated doc reference
                    userId: currentUser.uid,
                    fileName: filename,
                    originalName: file.name, // Keep original name if needed
                    type: 'model', // Add the type field
                    storagePath: storagePath,
                    downloadURL: downloadURL,
                    uploadedAt: serverTimestamp(),
                    size: file.size,
                    contentType: file.type
                });
                console.log(`Firestore metadata added for ${filename}`);
                // No need to update state manually, onSnapshot listener will handle it.

            } catch (error) {
                console.error(`Error uploading ${filename} via dashboard:`, error);
                // TODO: Show error message to user in the UI
            }

        } else if (file && !file.name.toLowerCase().endsWith('.ply')) {
            console.warn('User attempted to upload a non-.ply file via button:', file.name);
            // alert('Please select a .ply file.'); // Replaced alert with console warning
            console.warn('Upload failed: Please select a .ply file.'); // Provide feedback via console
        } else if (!currentUser) {
            console.error('Cannot upload: User not logged in.');
            // alert('You must be logged in to upload files.'); // Replaced alert with console log for better practice
            console.error('Upload failed: User must be logged in.');
        }

        // Reset file input value so the same file can be selected again if needed
        if (event.target) {
            event.target.value = ''; // Safer way to reset
        }
    };


    const toggleTheme = () => {
        setCurrentTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    // Filter models based on search query (use fileName now)
    const filteredModels = useMemo(() => {
        if (!searchQuery) {
            return models;
        }
        return models.filter(model => model.fileName.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [models, searchQuery]);


    if (isLoading) {
        // TODO: Replace with a nicer loading spinner component
        return <div className="loading-indicator">Loading...</div>;
    }

    return (
        <div className="dashboard-page">
            {/* NEW: Intro Section */}
            <section className="intro">
                <h2>Welcome to GSPLAT Web Viewer</h2>
                <p>
                    This tool allows you to upload, manage, and view 3D models created using{' '}
                    <strong>Gaussian Splatting</strong> (.ply format). Gaussian Splatting is a
                    modern rendering technique that represents scenes with millions of 3D Gaussians,
                    enabling high-quality, real-time rendering of complex captures.
                </p>
                <p>
                    Upload your scans, view them instantly in your browser, and manage your model library.
                </p>
            </section>

            {/* NEW: Get Started Section */}
            <section className="get-started">
                <h3>Get Started</h3>
                <div className="get-started-content">
                    <div className="upload-instructions">
                        <h4>Uploading Your Scans</h4>
                        <p>
                            Use the "Upload New Model" button below to add your <code>.ply</code> files.
                        </p>
                        <p>
                            <strong>📱 Mobile Uploads:</strong> You can easily upload scans captured on your phone!
                            Simply navigate to this page on your mobile browser, log in, and use the upload button
                            to select the <code>.ply</code> file directly from your phone's storage or camera roll.
                        </p>
                    </div>
                    {/* Optional: Add sign-in info if needed, though routing handles it */}
                    {/* <div className="account-info">
                        <h4>Account</h4>
                        <p>You are currently logged in. Use the logout button in the header to sign out.</p>
                    </div> */}
                </div>
            </section>

            <header className="dashboard-header">
                <h1>Model Dashboard</h1>
                <div className="header-actions">
                    <button onClick={toggleTheme} className="theme-button icon-button" title={`Switch to ${currentTheme === 'light' ? 'Dark' : 'Light'} Theme`}>
                        {currentTheme === 'light' ? '🌙' : '☀️'} {/* Simple icons */}
                    </button>
                    <button onClick={handleLogout} className="logout-button" title="Logout">Logout</button>
                </div>
            </header>

            <section className="dashboard-section upload-section">
                <h3>Upload New Model</h3>
                <label htmlFor="dashboard-upload-input" className="upload-button">
                    Choose .ply File
                </label>
                <input
                    id="dashboard-upload-input"
                    type="file"
                    accept=".ply"
                    onChange={handleDashboardUpload}
                    style={{ display: 'none' }} // Hide default input
                />
                {/* TODO: Add visual feedback for selected file name */}
            </section>

            <section className="dashboard-section models-section">
                <div className="models-header">
                    <h3>Uploaded Models</h3>
                    <input
                        className="search-input"
                        type="search"
                        placeholder='Search models...'
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                {filteredModels.length === 0 ? (
                    <p className='no-models-message'>
                        {searchQuery ? 'No models match your search.' : 'No models uploaded yet.'}
                    </p>
                ) : (
                    <div className='model-grid'> {/* Changed from ul to div for grid layout */}
                        {filteredModels.map(model => (
                            <div key={model.id} className='model-card'>
                                <div className='model-card-content'>
                                    <span className='model-name'>
                                        {model.fileName}
                                    </span>
                                    {/* Add more details like upload date if available */}
                                    {/* <span className='model-date'>{model.uploadedAt ? new Date(model.uploadedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</span> */}
                                </div>
                                <div className='model-card-actions'>
                                    <button onClick={() => handleModelSelect(model)} className='action-button view-button' title="View Model">
                                        👁️ {/* View icon */}
                                    </button>
                                    <button onClick={() => handleRemoveModel(model)} className='action-button remove-button' title="Remove Model">
                                        🗑️ {/* Remove icon */}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default DashboardPage;
