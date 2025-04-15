import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { path } from 'playcanvas';

import { auth, storage, db } from './firebase-config'; // Firebase services

// Interface for files passed to the original handler
interface OriginalFile {
    url: string;
    filename?: string;
}

// Interface for the result of processing each dropped entry
interface ProcessedFileEntry {
    url?: string; // Only present for non-Firebase uploads
    filename?: string;
    firebaseUploaded: boolean; // Flag to indicate if handled by Firebase
    firebaseInfo?: { // Optional info about the Firebase upload
        storagePath: string;
        downloadURL: string;
    };
    error?: string; // Optional error message
}


type DropHandlerFunc = (files: Array<OriginalFile>, resetScene: boolean) => void;

const resolveDirectories = (entries: Array<FileSystemEntry>): Promise<Array<FileSystemFileEntry>> => {
    const promises: Promise<Array<FileSystemFileEntry>>[] = [];
    const result: Array<FileSystemFileEntry> = [];

    entries.forEach((entry) => {
        if (entry.isFile) {
            result.push(entry as FileSystemFileEntry);
        } else if (entry.isDirectory) {
            promises.push(new Promise<any>((resolve) => {
                const reader = (entry as FileSystemDirectoryEntry).createReader();

                const p: Promise<any>[] = [];

                const read = () => {
                    reader.readEntries((children: Array<FileSystemEntry>) => {
                        if (children.length > 0) {
                            p.push(resolveDirectories(children));
                            read();
                        } else {
                            Promise.all(p)
                            .then((children: Array<Array<FileSystemFileEntry>>) => {
                                resolve(children.flat());
                            });
                        }
                    });
                };
                read();
            }));
        }
    });

    return Promise.all(promises)
    .then((children: Array<Array<FileSystemFileEntry>>) => {
        return result.concat(...children);
    });
};

// Note: Changed 'File' to 'OriginalFile' to match the interface used
const removeCommonPrefix = (urls: Array<OriginalFile>) => {
    const split = (pathname: string) => {
        // If filename is undefined, return early or handle appropriately
        if (!pathname) return ['', ''];
        const parts = pathname.split(path.delimiter);
        const base = parts[0];
        const rest = parts.slice(1).join(path.delimiter);
        return [base, rest];
    };

    // Ensure urls array is not empty and first element has a filename
    if (!urls || urls.length === 0 || !urls[0].filename) {
        return;
    }

    while (true) {
        const parts = split(urls[0].filename);
        // Check if splitting resulted in a valid second part
        if (!parts[1] || parts[1].length === 0) {
            return;
        }
        let allMatch = true;
        for (let i = 1; i < urls.length; ++i) {
            // Ensure other elements also have filenames before splitting
            if (!urls[i].filename) {
                allMatch = false; // Or handle this case differently? For now, stop prefix removal.
                break;
            }
            const other = split(urls[i].filename);
            if (parts[0] !== other[0]) {
                allMatch = false;
                break;
            }
        }

        if (!allMatch) {
            return;
        }

        // All prefixes matched, remove them
        for (let i = 0; i < urls.length; ++i) {
            // Ensure filename exists before attempting to split and assign
            if (urls[i].filename) {
                urls[i].filename = split(urls[i].filename)[1];
            }
        }
    }
};

// configure drag and drop
const CreateDropHandler = (target: HTMLElement, dropHandler: DropHandlerFunc) => {
    target.addEventListener('dragstart', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        ev.dataTransfer.effectAllowed = 'all';
    }, false);

    target.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        ev.dataTransfer.effectAllowed = 'all';
    }, false);

    target.addEventListener('drop', (ev) => {
        ev.preventDefault();

        const entries =
            Array.from(ev.dataTransfer.items)
            .map(item => item.webkitGetAsEntry());

        const currentUser = auth.currentUser;
        const resetScene = !ev.shiftKey;

        resolveDirectories(entries)
        .then((resolvedEntries: Array<FileSystemFileEntry>) => {
            // Process each entry: upload .ply to Firebase if logged in, otherwise prepare for original handler
            return Promise.all(resolvedEntries.map((entry): Promise<ProcessedFileEntry> => {
                return new Promise((resolve) => {
                    entry.file((entryFile: globalThis.File) => { // Use globalThis.File for clarity
                        const filename = entry.fullPath.substring(1); // Keep original path logic for now
                        const isPlyFile = filename.toLowerCase().endsWith('.ply');

                        if (isPlyFile && currentUser) {
                            // Handle .ply upload for authenticated user
                            const storagePath = `users/${currentUser.uid}/uploads/${filename}`;
                            const storageRef = ref(storage, storagePath);

                            console.log(`Uploading ${filename} to ${storagePath}...`);
                            uploadBytes(storageRef, entryFile)
                                .then(snapshot => getDownloadURL(snapshot.ref))
                                .then((downloadURL) => {
                                    console.log(`Successfully uploaded ${filename}. URL: ${downloadURL}`);
                                    // Add metadata to Firestore
                                    addDoc(collection(db, 'plyFiles'), {
                                        userId: currentUser.uid,
                                        fileName: filename, // Use the extracted filename
                                        originalName: entryFile.name, // Keep original file name too
                                        storagePath: storagePath,
                                        downloadURL: downloadURL,
                                        uploadedAt: serverTimestamp(),
                                        size: entryFile.size,
                                        contentType: entryFile.type
                                    }).then(() => {
                                        console.log(`Firestore metadata added for ${filename}`);
                                        resolve({
                                            filename: filename,
                                            firebaseUploaded: true,
                                            firebaseInfo: { storagePath, downloadURL }
                                        });
                                    }).catch((firestoreError) => {
                                        console.error(`Error adding Firestore metadata for ${filename}:`, firestoreError);
                                        resolve({ filename: filename, firebaseUploaded: false, error: 'Firestore metadata error' }); // Treat as failure, pass to original handler? Or just log? For now, log and mark as not uploaded.
                                    });
                                })
                                .catch((uploadError) => {
                                    console.error(`Error uploading ${filename}:`, uploadError);
                                    resolve({ filename: filename, firebaseUploaded: false, error: 'Upload error' }); // Failed upload, pass to original handler
                                });
                        } else {
                            // Not a .ply file or user not logged in, prepare for original handler
                            const objectURL = URL.createObjectURL(entryFile);
                            resolve({
                                url: objectURL,
                                filename: filename,
                                firebaseUploaded: false
                            });
                        }
                    }, (err) => {
                        console.error(`Error accessing file ${entry.name}:`, err);
                        resolve({ filename: entry.name, firebaseUploaded: false, error: 'File access error' });
                    });
                });
            }));
        })
        .then((processedFiles: Array<ProcessedFileEntry>) => {
            // Separate files handled by Firebase from those for the original handler
            const filesForOriginalHandler: OriginalFile[] = [];
            processedFiles.forEach((pf) => {
                if (!pf.firebaseUploaded && pf.url) { // Only pass files that weren't uploaded and have a URL
                    filesForOriginalHandler.push({ url: pf.url, filename: pf.filename });
                } else if (pf.firebaseUploaded) {
                    console.log(`${pf.filename} was uploaded to Firebase.`);
                    // Optionally revoke object URL if created? Not needed here as URL is only created if !firebaseUploaded
                } else if (pf.error) {
                    console.error(`Skipping file ${pf.filename} due to error: ${pf.error}`);
                    // Decide if errored files should still be passed? For now, no.
                }
            });

            // Clean up filenames and call original handler if there are files left for it
            if (filesForOriginalHandler.length > 0) {
                if (filesForOriginalHandler.length > 1) {
                    removeCommonPrefix(filesForOriginalHandler); // Use the existing prefix removal logic
                }
                console.log(`Passing ${filesForOriginalHandler.length} file(s) to original drop handler.`);
                dropHandler(filesForOriginalHandler, resetScene);
            } else {
                console.log('No files to pass to original drop handler.');
                // If resetScene was true, we might still need to signal a scene reset even if no files load?
                // Check if dropHandler needs to be called even with empty array for resetScene logic.
                // Assuming dropHandler handles empty array gracefully or resetScene logic is separate.
                if (resetScene) {
                    // Potentially call dropHandler([], resetScene) if needed for reset logic
                    // Or handle reset logic directly here if appropriate
                }
            }
        })
        .catch((err) => {
            console.error('Error processing dropped files:', err);
        });
    }, false);
};

export { CreateDropHandler, OriginalFile as File }; // Export OriginalFile as File for compatibility if needed elsewhere
