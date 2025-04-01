import React, { useState, useEffect, useMemo } from 'react';

interface StoredModel {
    name: string;
    url: string; // This will be a Blob URL for uploaded files
    id: string; // Add a unique ID for stable key and removal
}

type Theme = 'light' | 'dark';

const DashboardPage: React.FC = () => {
    const [models, setModels] = useState<StoredModel[]>([]);
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
        localStorage.setItem('userTheme', currentTheme); // Persist theme choice
    }, [currentTheme]);

    useEffect(() => {
        // Check login status
        const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
        if (!loggedIn) {
            // Redirect to login if not logged in
            // In a real app with routing, this would be cleaner
            window.location.hash = '#/login'; // Simple hash-based routing trigger
            // window.location.reload(); // Removed reload
            return;
        }

        // Load models from localStorage
        const storedModelsRaw = localStorage.getItem('uploadedModels');
        if (storedModelsRaw) {
            try {
                // Ensure models have IDs, add if missing (for backward compatibility)
                const parsedModels: StoredModel[] = JSON.parse(storedModelsRaw).map((m: any) => ({
                    ...m,
                    id: m.id || crypto.randomUUID() // Add UUID if id doesn't exist
                }));
                setModels(parsedModels);
            } catch (e) {
                console.error('Failed to parse stored models:', e);
                localStorage.removeItem('uploadedModels'); // Clear corrupted data
            }
        }
        setIsLoading(false);
    }, []); // Run only on mount

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.name.toLowerCase().endsWith('.ply')) {
            const blobUrl = URL.createObjectURL(file);
            const newModel: StoredModel = {
                name: file.name,
                url: blobUrl,
                id: crypto.randomUUID() // Generate a unique ID
            };

            // Update state and localStorage
            const updatedModels = [...models, newModel];
            // Revoke old URL if replacing a model with the same name (optional, depends on desired behavior)
            // const existingIndex = models.findIndex(m => m.name === file.name);
            // if (existingIndex > -1) {
            //     URL.revokeObjectURL(models[existingIndex].url);
            // }

            setModels(updatedModels);
            localStorage.setItem('uploadedModels', JSON.stringify(updatedModels));

            // Set current model and navigate to viewer
            localStorage.setItem('currentModelUrl', blobUrl);
            localStorage.setItem('currentModelName', file.name);
            window.location.hash = '#/viewer';
        } else if (file) {
            console.warn('User attempted to upload a non-.ply file:', file.name);
            // TODO: Show a user-friendly message in the UI instead of console/alert
        }
        // Reset file input
        event.target.value = '';
    };

    const handleModelSelect = (model: StoredModel) => {
        localStorage.setItem('currentModelUrl', model.url);
        localStorage.setItem('currentModelName', model.name);
        window.location.hash = '#/viewer';
    };

    const handleRemoveModel = (modelToRemove: StoredModel) => {
        // Revoke the Blob URL to free up memory
        URL.revokeObjectURL(modelToRemove.url);

        // Filter out the model
        const updatedModels = models.filter(model => model.id !== modelToRemove.id);
        setModels(updatedModels);
        localStorage.setItem('uploadedModels', JSON.stringify(updatedModels));

        // If the removed model was the 'current' one, clear it
        if (localStorage.getItem('currentModelUrl') === modelToRemove.url) {
            localStorage.removeItem('currentModelUrl');
            localStorage.removeItem('currentModelName');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('currentModelUrl');
        localStorage.removeItem('currentModelName');
        // Revoke all blob URLs associated with the session on logout
        models.forEach(model => URL.revokeObjectURL(model.url));
        localStorage.removeItem('uploadedModels'); // Clear models on logout
        window.location.hash = '#/login';
    };

    const toggleTheme = () => {
        setCurrentTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    // Filter models based on search query
    const filteredModels = useMemo(() => {
        if (!searchQuery) {
            return models;
        }
        return models.filter(model =>
            model.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
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

            <div className="dashboard-section">
                <h3>Upload New .ply Model</h3>
                <input type="file" accept=".ply" onChange={handleFileUpload} />
                {/* TODO: Add better feedback for non-ply uploads */}
            </div>

            <div className="dashboard-section">
                <h3>Previously Uploaded Models</h3>
                <input
                    type="search"
                    placeholder="Search models by name..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
                {filteredModels.length === 0 ? (
                    <p className="no-models-message">
                        {searchQuery ? 'No models match your search.' : 'No models uploaded yet.'}
                    </p>
                ) : (
                    <ul className="model-list">
                        {filteredModels.map((model) => (
                            <li key={model.id} className="model-list-item">
                                <span className="model-name" onClick={() => handleModelSelect(model)}>
                                    {model.name}
                                </span>
                                <button
                                    onClick={() => handleRemoveModel(model)}
                                    className="remove-model-button"
                                >
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
