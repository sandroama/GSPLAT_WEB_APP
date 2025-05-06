import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, doc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore'; // Changed addDoc to setDoc
import { ref, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import React, { useState, useEffect, useMemo, useRef } from 'react';

import { auth, db, storage } from '../firebase-config'; // Import Firebase services

// Updated interface to match Firestore data structure
interface FirestoreModel {
    id: string; // Firestore document ID
    fileName: string;
    downloadURL: string;
    uploadedAt?: any; // Keep timestamp if needed for sorting
    size?: number;
    // Add other fields if necessary (e.g., originalName, size)
}

type Theme = 'light' | 'dark';

const DashboardPage: React.FC = () => {
    // Corrected state initialization
    const [models, setModels] = useState<FirestoreModel[]>([]); // Use FirestoreModel
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
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

    const handleRemoveModel = async (modelToRemove: FirestoreModel, event: React.MouseEvent) => {
        event.stopPropagation(); // Prevent triggering the parent click handler
        
        if (!auth.currentUser) return; // Should not happen, but check anyway
        
        if (!window.confirm(`Are you sure you want to remove ${modelToRemove.fileName}?`)) {
            return;
        }

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
            setIsUploading(true);
            const filename = file.name; // Use original filename

            // Generate a unique ID for the model document and storage folder
            const newModelDocRef = doc(collection(db, 'users', currentUser.uid, 'models'));
            const newModelId = newModelDocRef.id;

            const storagePath = `users/${currentUser.uid}/models/${newModelId}/${filename}`;
            const storageRef = ref(storage, storagePath);

            console.log(`Uploading ${filename} via dashboard button to ${storagePath}...`);
            
            try {
                // Upload file with progress monitoring
                const uploadTask = uploadBytes(storageRef, file);
                
                // Progress not directly available with uploadBytes, so we simulate progress
                // In a real app, you would use Firebase Storage's uploadTask.on('state_changed', ...)
                setUploadProgress(prev => ({...prev, [newModelId]: 0}));
                
                // Simulate progress (in a real app, you'd get this from Firebase)
                const simulateProgress = () => {
                    let progress = 0;
                    const interval = setInterval(() => {
                        progress += Math.random() * 15;
                        if (progress > 90) {
                            clearInterval(interval);
                            progress = 90; // Cap at 90% until complete
                        }
                        setUploadProgress(prev => ({...prev, [newModelId]: Math.min(progress, 90)}));
                    }, 300);
                    
                    return interval;
                };
                
                const progressInterval = simulateProgress();
                
                // Complete the upload
                const snapshot = await uploadTask;
                clearInterval(progressInterval);
                setUploadProgress(prev => ({...prev, [newModelId]: 100}));
                
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
                
                // Clean up progress tracking after a delay
                setTimeout(() => {
                    setUploadProgress(prev => {
                        const newProgress = {...prev};
                        delete newProgress[newModelId];
                        return newProgress;
                    });
                    setIsUploading(false);
                }, 1000);

            } catch (error) {
                console.error(`Error uploading ${filename} via dashboard:`, error);
                setUploadProgress(prev => {
                    const newProgress = {...prev};
                    delete newProgress[newModelId];
                    return newProgress;
                });
                setIsUploading(false);
                alert(`Error uploading ${filename}: ${error}`);
            }

        } else if (file && !file.name.toLowerCase().endsWith('.ply')) {
            console.warn('User attempted to upload a non-.ply file via button:', file.name);
            alert('Please select a .ply file.');
        } else if (!currentUser) {
            console.error('Cannot upload: User not logged in.');
            alert('You must be logged in to upload files.');
        }

        // Reset file input value so the same file can be selected again if needed
        if (event.target) {
            event.target.value = '';
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
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

    // Format file size for display
    const formatFileSize = (bytes?: number): string => {
        if (bytes === undefined) return 'Unknown size';
        
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    };

    if (isLoading) {
        return (
            <div className="loading-indicator">
                <div className="spinner"></div>
                <span>Loading models...</span>
            </div>
        );
    }

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <h2>Gaussian Splatting Models</h2>
                <div className="theme-controls">
                    <button onClick={toggleTheme} className="theme-button btn btn-outlined">
                        Switch to {currentTheme === 'light' ? 'Dark' : 'Light'} Mode
                    </button>
                    <button onClick={handleLogout} className="logout-button btn">Logout</button>
                </div>
            </div>

            <div className="dashboard-section">
                <h3>Upload New Model</h3>
                
                <input 
                    type="file" 
                    ref={fileInputRef}
                    accept=".ply" 
                    onChange={handleDashboardUpload} 
                    style={{display: 'none'}}
                />
                
                <div 
                    className="file-upload-container" 
                    onClick={triggerFileInput}
                    style={{opacity: isUploading ? 0.7 : 1, pointerEvents: isUploading ? 'none' : 'auto'}}
                >
                    <div className="file-upload-icon">
                        {isUploading ? '⏳' : '📁'}
                    </div>
                    <div className="file-upload-text">
                        {isUploading ? 'Uploading...' : 'Click to upload a .ply file'}
                    </div>
                    <div className="file-upload-hint">
                        or drag and drop your file here
                    </div>
                </div>
                
                {/* Show upload progress if any uploads are in progress */}
                {Object.keys(uploadProgress).length > 0 && (
                    <div className="upload-progress">
                        {Object.entries(uploadProgress).map(([id, progress]) => (
                            <div key={id} className="progress-bar-container">
                                <div className="progress-bar" style={{width: `${progress}%`}}></div>
                                <div className="progress-text">{progress.toFixed(0)}%</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="dashboard-section">
                <h3>Your Models</h3>
                <input
                    type="search"
                    className="form-control"
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
                            <li key={model.id} className='model-list-item' onClick={() => handleModelSelect(model)}>
                                <div className="model-thumbnail">
                                    <span style={{fontSize: '2rem'}}>📊</span>
                                </div>
                                <div className="model-name" title={model.fileName}>
                                    {model.fileName}
                                </div>
                                <div className="model-info text-secondary" style={{padding: '0 var(--space-md)'}}>
                                    {formatFileSize(model.size)}
                                </div>
                                <div className="model-actions">
                                    <button 
                                        className="model-action-button view"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleModelSelect(model);
                                        }}
                                    >
                                        View
                                    </button>
                                    <button 
                                        className="model-action-button remove"
                                        onClick={(e) => handleRemoveModel(model, e)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default DashboardPage;
