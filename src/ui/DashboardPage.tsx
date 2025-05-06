import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, doc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Search, 
    LogOut, 
    Upload, 
    X, 
    Sun, 
    Moon, 
    HelpCircle, 
    Trash2, 
    Eye, 
    Palette, 
    ChevronDown, 
    AlertCircle,
    FileUp,
    Grid,
    List,
    Settings,
    User
} from "lucide-react";

import { auth, db, storage } from '../firebase-config';

interface FirestoreModel {
    id: string;
    fileName: string;
    downloadURL: string;
    uploadedAt?: any;
    size?: number;
}

type Theme = "light" | "dark" | "blue" | "purple" | "green";
type ViewMode = "grid" | "list";

const DashboardPage: React.FC = () => {
    const [models, setModels] = useState<FirestoreModel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
        return (localStorage.getItem('userTheme') as Theme) || 'light';
    });
    const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showWelcomePopup, setShowWelcomePopup] = useState(true);
    const [showHowToUseModal, setShowHowToUseModal] = useState(false);
    const [showThemeSelector, setShowThemeSelector] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        return (localStorage.getItem('viewMode') as ViewMode) || 'grid';
    });
    const [showUserMenu, setShowUserMenu] = useState(false);

    useEffect(() => {
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${currentTheme}`);
        localStorage.setItem('userTheme', currentTheme);
    }, [currentTheme]);

    useEffect(() => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            window.location.hash = '#/login';
            return;
        }

        setIsLoading(true);
        const modelsCollectionRef = collection(db, 'users', currentUser.uid, 'models');
        const q = query(
            modelsCollectionRef,
            orderBy('uploadedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const fetchedModels: FirestoreModel[] = [];
            querySnapshot.forEach((doc) => {
                fetchedModels.push({ id: doc.id, ...doc.data() } as FirestoreModel);
            });
            setModels(fetchedModels);
            setIsLoading(false);
        }, (error) => {
            console.error('Error fetching models:', error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleModelSelect = (model: FirestoreModel) => {
        localStorage.setItem('currentModelUrl', model.downloadURL);
        localStorage.setItem('currentModelName', model.fileName);
        window.location.hash = '#/viewer';
    };

    const handleRemoveModel = async (modelToRemove: FirestoreModel) => {
        if (!auth.currentUser) return;

        try {
            const docRef = doc(db, 'users', auth.currentUser.uid, 'models', modelToRemove.id);
            await deleteDoc(docRef);

            const storagePath = `users/${auth.currentUser.uid}/models/${modelToRemove.id}/${modelToRemove.fileName}`;
            const storageRef = ref(storage, storagePath);
            await deleteObject(storageRef);

            if (localStorage.getItem('currentModelName') === modelToRemove.fileName) {
                localStorage.removeItem('currentModelUrl');
                localStorage.removeItem('currentModelName');
            }
        } catch (error) {
            console.error(`Error removing model:`, error);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const handleDashboardUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        const currentUser = auth.currentUser;

        if (file && currentUser && file.name.toLowerCase().endsWith('.ply')) {
            setIsUploading(true);
            const filename = file.name;
            const newModelDocRef = doc(collection(db, 'users', currentUser.uid, 'models'));
            const newModelId = newModelDocRef.id;
            const storagePath = `users/${currentUser.uid}/models/${newModelId}/${filename}`;
            const storageRef = ref(storage, storagePath);

            try {
                const snapshot = await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(snapshot.ref);

                await setDoc(newModelDocRef, {
                    userId: currentUser.uid,
                    fileName: filename,
                    originalName: file.name,
                    type: 'model',
                    storagePath: storagePath,
                    downloadURL: downloadURL,
                    uploadedAt: serverTimestamp(),
                    size: file.size,
                    contentType: file.type
                });
            } catch (error) {
                console.error(`Error uploading file:`, error);
            } finally {
                setIsUploading(false);
                if (event.target) {
                    event.target.value = '';
                }
            }
        }
    };

    const toggleTheme = () => {
        setCurrentTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    const toggleViewMode = () => {
        const newMode = viewMode === 'grid' ? 'list' : 'grid';
        setViewMode(newMode);
        localStorage.setItem('viewMode', newMode);
    };

    const formatFileSize = (bytes?: number): string => {
        if (bytes === undefined) return "Unknown size";
        const units = ["B", "KB", "MB", "GB"];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    };

    const filteredModels = useMemo(() => {
        if (!searchQuery) return models;
        return models.filter(model => 
            model.fileName.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [models, searchQuery]);

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <span>Loading your models...</span>
            </div>
        );
    }

    return (
        <div className="dashboard-page">
            <header className="dashboard-header">
                <div className="header-left">
                    <h1>My Models</h1>
                    <div className="search-container">
                        <Search size={20} />
                        <input
                            type="text"
                            placeholder="Search models..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </div>
                
                <div className="header-right">
                    <button 
                        className="view-toggle-btn"
                        onClick={toggleViewMode}
                        title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
                    >
                        {viewMode === 'grid' ? <List size={20} /> : <Grid size={20} />}
                    </button>
                    
                    <button 
                        className="theme-toggle-btn"
                        onClick={toggleTheme}
                        title={`Switch to ${currentTheme === 'light' ? 'dark' : 'light'} theme`}
                    >
                        {currentTheme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                    </button>

                    <div className="user-menu-container">
                        <button 
                            className="user-menu-btn"
                            onClick={() => setShowUserMenu(!showUserMenu)}
                        >
                            <User size={20} />
                        </button>
                        {showUserMenu && (
                            <div className="user-menu">
                                <button onClick={handleLogout} className="menu-item">
                                    <LogOut size={18} />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="dashboard-main">
                <div className="upload-section">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleDashboardUpload}
                        accept=".ply"
                        className="hidden"
                    />
                    <button 
                        className="upload-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                    >
                        <FileUp size={20} />
                        <span>{isUploading ? 'Uploading...' : 'Upload Model'}</span>
                    </button>
                </div>

                {filteredModels.length === 0 ? (
                    <div className="empty-state">
                        <FileUp size={48} />
                        <h2>No models found</h2>
                        <p>Upload your first .ply model to get started</p>
                    </div>
                ) : (
                    <div className={`models-container ${viewMode}`}>
                        {filteredModels.map((model) => (
                            <div key={model.id} className="model-card">
                                <div className="model-preview">
                                    <img 
                                        src="static/Gsplat_main.png" 
                                        alt={model.fileName}
                                        className="preview-image"
                                    />
                                </div>
                                <div className="model-info">
                                    <h3 className="model-name">{model.fileName}</h3>
                                    <p className="model-size">{formatFileSize(model.size)}</p>
                                </div>
                                <div className="model-actions">
                                    <button 
                                        className="action-btn view-btn"
                                        onClick={() => handleModelSelect(model)}
                                        title="View Model"
                                    >
                                        <Eye size={18} />
                                    </button>
                                    <button 
                                        className="action-btn delete-btn"
                                        onClick={() => handleRemoveModel(model)}
                                        title="Delete Model"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default DashboardPage;
