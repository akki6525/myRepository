import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { photoTexts } from './data/photoTexts'

// Dynamically import all images and videos from the journey folder
const mediaModules = import.meta.glob('/src/assets/journey/**/*.{jpg,jpeg,png,webp,JPG,mp4,webm,mov,ogg}', { eager: true }) as Record<string, { default: string }>;

const CAPTIONS_STORAGE_KEY = 'journey-photo-captions';

interface FileInfo {
  path: string;
  url: string;
  parts: string[];
  type: 'image' | 'video';
  relativePath: string;
}

// Load captions from localStorage merged with defaults
function loadCaptions(): Record<string, string> {
  try {
    const stored = localStorage.getItem(CAPTIONS_STORAGE_KEY);
    const customCaptions = stored ? JSON.parse(stored) : {};
    return { ...photoTexts, ...customCaptions };
  } catch {
    return { ...photoTexts };
  }
}

// Save only custom captions (overrides) to localStorage
function saveCaptions(captions: Record<string, string>) {
  const customCaptions: Record<string, string> = {};
  for (const key in captions) {
    // Only save if different from default or not in defaults
    if (captions[key] !== photoTexts[key]) {
      customCaptions[key] = captions[key];
    }
  }
  localStorage.setItem(CAPTIONS_STORAGE_KEY, JSON.stringify(customCaptions));
}

function App() {
  const [currentPath, setCurrentPath] = useState<string[]>([])
  const [captions, setCaptions] = useState<Record<string, string>>({})
  const [editingItem, setEditingItem] = useState<FileInfo | null>(null)
  const [editText, setEditText] = useState('')

  // Load captions on mount
  useEffect(() => {
    setCaptions(loadCaptions());
  }, []);

  // Process media into a flat list of metadata
  const allMedia = useMemo(() => {
    return Object.keys(mediaModules).map(key => {
      const lowerKey = key.toLowerCase();
      const isVideo = lowerKey.endsWith('.mp4') || lowerKey.endsWith('.webm') || lowerKey.endsWith('.mov') || lowerKey.endsWith('.ogg');

      const relativePath = key.replace('/src/assets/journey/', '');
      return {
        path: key,
        url: mediaModules[key].default,
        parts: relativePath.split('/'),
        type: isVideo ? 'video' : 'image',
        relativePath
      } as FileInfo;
    });
  }, []);

  // Helper to find a thumbnail for a folder
  const getFolderThumbnail = (folderParts: string[]) => {
    // Find the first image that is deep inside this folder
    const item = allMedia.find(m =>
      m.type === 'image' &&
      folderParts.every((part, i) => m.parts[i] === part)
    );
    return item?.url;
  };

  // Determine what to show in the current folder
  const currentView = useMemo(() => {
    const folderNames = new Set<string>();
    const media: FileInfo[] = [];

    allMedia.forEach(item => {
      const isInside = currentPath.every((part, i) => item.parts[i] === part);

      if (isInside) {
        const nextPart = item.parts[currentPath.length];
        if (nextPart) {
          if (item.parts.length > currentPath.length + 1) {
            folderNames.add(nextPart);
          } else {
            media.push(item);
          }
        }
      }
    });

    const folders = Array.from(folderNames).sort().map(name => ({
      name,
      thumbnail: getFolderThumbnail([...currentPath, name])
    }));

    return {
      folders,
      media: media.sort((a, b) => a.parts[a.parts.length - 1].localeCompare(b.parts[b.parts.length - 1]))
    };
  }, [allMedia, currentPath]);

  const navigateTo = (folder: string) => {
    setCurrentPath([...currentPath, folder])
  }

  const navigateBack = () => {
    setCurrentPath(currentPath.slice(0, -1))
  }

  const navigateToLevel = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1))
  }

  // Open edit modal
  const openEditModal = useCallback((item: FileInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItem(item);
    setEditText(captions[item.relativePath] || '');
  }, [captions]);

  // Close edit modal
  const closeEditModal = useCallback(() => {
    setEditingItem(null);
    setEditText('');
  }, []);

  // Save caption
  const saveCaption = useCallback(() => {
    if (!editingItem) return;

    const newCaptions = { ...captions };
    if (editText.trim()) {
      newCaptions[editingItem.relativePath] = editText.trim();
    } else {
      delete newCaptions[editingItem.relativePath];
    }

    setCaptions(newCaptions);
    saveCaptions(newCaptions);
    closeEditModal();
  }, [editingItem, editText, captions, closeEditModal]);

  // Handle keyboard events in modal
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeEditModal();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      saveCaption();
    }
  }, [closeEditModal, saveCaption]);

  return (
    <div className="app-container">
      <header>
        <h1>Life Journey</h1>
        <p className="subtitle">Exploring the chapters of my life, one folder at a time.</p>
      </header>

      <nav className="navigation-bar">
        <div className="breadcrumb">
          <span className={`breadcrumb-item ${currentPath.length === 0 ? 'active' : ''}`} onClick={() => setCurrentPath([])}>
            Journey
          </span>
          {currentPath.map((part, i) => (
            <React.Fragment key={i}>
              <span className="breadcrumb-separator">/</span>
              <span
                className={`breadcrumb-item ${i === currentPath.length - 1 ? 'active' : ''}`}
                onClick={() => navigateToLevel(i)}
              >
                {part}
              </span>
            </React.Fragment>
          ))}
        </div>
      </nav>

      <main className="gallery-grid">
        {currentPath.length > 0 && (
          <div className="photo-card back-card" onClick={navigateBack}>
            <div className="folder-card empty">
              <span style={{ fontSize: '3rem' }}>⬅️</span>
              <span className="folder-name">Go Back</span>
            </div>
          </div>
        )}

        {currentView.folders.map((folder) => (
          <div key={folder.name} className="photo-card" onClick={() => navigateTo(folder.name)}>
            <div className="photo-wrapper">
              {folder.thumbnail ? (
                <img src={folder.thumbnail} alt={folder.name} loading="lazy" />
              ) : (
                <div className="folder-placeholder">
                  <svg className="folder-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                  </svg>
                </div>
              )}
              <div className="folder-overlay">
                <svg className="mini-folder-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                </svg>
                <span className="folder-name">{folder.name}</span>
              </div>
            </div>
          </div>
        ))}

        {currentView.media.map((item) => (
          <div key={item.path} className="photo-card">
            <div className="photo-wrapper">
              {item.type === 'video' ? (
                <video
                  src={item.url}
                  muted
                  loop
                  playsInline
                  onMouseEnter={(e) => e.currentTarget.play()}
                  onMouseLeave={(e) => {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0;
                  }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <img src={item.url} alt="Journal media" loading="lazy" />
              )}
              {item.type === 'video' && (
                <div className="video-badge">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  VIDEO
                </div>
              )}

              {/* Edit button - always visible */}
              <button
                className="edit-caption-btn"
                onClick={(e) => openEditModal(item, e)}
                title="Edit caption"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                </svg>
              </button>

              {/* Hover text overlay */}
              {captions[item.relativePath] && (
                <div className="hover-text-overlay">
                  <span className="hover-text">{captions[item.relativePath]}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </main>

      {currentView.folders.length === 0 && currentView.media.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem', opacity: 0.5 }}>
          <p>No photos or videos here.</p>
        </div>
      )}

      <footer style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <p>© {new Date().getFullYear()} My Life Journey</p>
      </footer>

      {/* Edit Caption Modal */}
      {editingItem && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
            <div className="modal-header">
              <h3>Edit Caption</h3>
              <button className="modal-close-btn" onClick={closeEditModal}>×</button>
            </div>

            <div className="modal-preview">
              {editingItem.type === 'video' ? (
                <video src={editingItem.url} muted loop autoPlay playsInline />
              ) : (
                <img src={editingItem.url} alt="Preview" />
              )}
            </div>

            <div className="modal-body">
              <label htmlFor="caption-input">Caption Text</label>
              <textarea
                id="caption-input"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="Enter a caption for this photo..."
                autoFocus
                rows={3}
              />
              <p className="modal-hint">Press Ctrl+Enter to save, Escape to cancel</p>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeEditModal}>Cancel</button>
              <button className="btn-primary" onClick={saveCaption}>Save Caption</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
