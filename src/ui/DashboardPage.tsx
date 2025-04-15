import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore'; // Added addDoc, serverTimestamp
import { ref, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage'; // Added uploadBytes, getDownloadURL
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
        const q = query(
            collection(db, 'plyFiles'),
            where('userId', '==', currentUser.uid),
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

        // 1. Delete Firestore document
        try {
            const docRef = doc(db, 'plyFiles', modelToRemove.id);
            await deleteDoc(docRef);
            console.log(`Firestore document ${modelToRemove.id} deleted.`);

            // 2. Delete file from Storage (construct path based on known structure)
            // Assuming storagePath was saved correctly during upload
            // If storagePath isn't in FirestoreModel, you'll need to add it or reconstruct it
            const storagePath = `users/${auth.currentUser.uid}/uploads/${modelToRemove.fileName}`; // Reconstruct path
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
            const storagePath = `users/${currentUser.uid}/uploads/${filename}`;
            const storageRef = ref(storage, storagePath);

            console.log(`Uploading ${filename} via dashboard button to ${storagePath}...`);
            // TODO: Add UI feedback for upload progress/completion/error

            try {
                // Upload file
                const snapshot = await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(snapshot.ref);
                console.log(`Successfully uploaded ${filename}. URL: ${downloadURL}`);

                // Add metadata to Firestore
                await addDoc(collection(db, 'plyFiles'), {
                    userId: currentUser.uid,
                    fileName: filename,
                    originalName: file.name,
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
            alert('Please select a .ply file.'); // Simple feedback for now
        } else if (!currentUser) {
            console.error('Cannot upload: User not logged in.');
            // alert('You must be logged in to upload files.'); // Replaced alert with console log for better practice
            console.error('Upload failed: User must be logged in.');
        }

        // Reset file input value so the same file can be selected again if needed
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        event.target!.value = ''; // Use non-null assertion or check target exists
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
            <div className="dashboard-header">
                <h2>Model Dashboard</h2>
                <div className="theme-controls">
                    <button onClick={toggleTheme} className="theme-button">
                        Switch to {currentTheme === 'light' ? 'Dark' : 'Light'} Theme
                    </button>
                    <button onClick={handleLogout} className="logout-button">Logout</button>
                </div>
            </div>

            {/* Re-added the upload section */}
            <div className="dashboard-section">
                <h3>Upload New .ply Model</h3>
                <input type="file" accept=".ply" onChange={handleDashboardUpload} />
                {/* Consider adding a visual button styled around the input if desired */}
            </div>

            <div className="dashboard-section">
                <h3>Uploaded Models</h3>
                <input
                    type="search"
                    placeholder='Search models by name...'
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
                {filteredModels.length === 0 ? (
                    <p className='no-models-message'>
                        {searchQuery ? 'No models match your search.' : 'No models uploaded yet.'}
                    </p>
                ) : (
                    <ul className='model-list'>
                        {filteredModels.map(model => (
                            <li key={model.id} className='model-list-item'>
                                <span className='model-name' onClick={() => handleModelSelect(model)}>
                                    {model.fileName} {/* Display fileName */}
                                </span>
                                <button onClick={() => handleRemoveModel(model)} className='remove-model-button'>
                                    Remove
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default DashboardPage;
