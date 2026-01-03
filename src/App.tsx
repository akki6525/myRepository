import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
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
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

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

  // Get all top-level folders dynamically
  const topLevelFolders = useMemo(() => {
    const folderMap = new Map<string, Set<string>>();

    allMedia.forEach(item => {
      const topFolder = item.parts[0];
      if (topFolder) {
        if (!folderMap.has(topFolder)) {
          folderMap.set(topFolder, new Set());
        }
        // Track subfolders
        const subFolder = item.parts[1];
        if (subFolder && item.parts.length > 2) {
          folderMap.get(topFolder)!.add(subFolder);
        }
      }
    });

    return Array.from(folderMap.entries()).map(([name, subfolders]) => ({
      name,
      subfolders: Array.from(subfolders).sort(),
      hasSubfolders: subfolders.size > 0
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allMedia]);

  // Get subfolders for a specific folder path
  const getSubfolders = useCallback((folderPath: string[]) => {
    const subfolderNames = new Set<string>();

    allMedia.forEach(item => {
      const isInside = folderPath.every((part, i) => item.parts[i] === part);
      if (isInside && item.parts.length > folderPath.length + 1) {
        const subFolder = item.parts[folderPath.length];
        if (subFolder) {
          subfolderNames.add(subFolder);
        }
      }
    });

    return Array.from(subfolderNames).sort();
  }, [allMedia]);

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

  // Detect if mobile device
  const isMobile = useMemo(() => {
    return window.innerWidth < 768 || 'ontouchstart' in window;
  }, []);

  // Physics-based interactive bubbles
  const [bubbles, setBubbles] = useState<{
    id: number;
    url: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
  }[]>([]);

  const mousePos = useRef({ x: -1000, y: -1000 });
  const containerRef = useRef<HTMLDivElement>(null);
  const frameCount = useRef(0);

  // Initialize bubbles with non-overlapping positions
  useEffect(() => {
    const images = allMedia.filter(m => m.type === 'image');
    const shuffled = [...images].sort(() => Math.random() - 0.5);

    // Fewer bubbles on mobile for better performance
    const bubbleCount = isMobile ? 6 : 12;
    const selectedImages = shuffled.slice(0, bubbleCount);

    const initialBubbles: typeof bubbles = [];
    const maxAttempts = 50;

    selectedImages.forEach((img, index) => {
      // Smaller bubbles on mobile
      const size = isMobile
        ? 70 + Math.random() * 50  // 70-120px on mobile
        : 90 + Math.random() * 70; // 90-160px on desktop

      let x = 0, y = 0;
      let attempts = 0;
      let overlapping = true;

      // Find non-overlapping position
      while (overlapping && attempts < maxAttempts) {
        x = size / 2 + Math.random() * (window.innerWidth - size);
        y = size / 2 + Math.random() * (window.innerHeight - size);
        overlapping = false;

        for (const other of initialBubbles) {
          const dx = x - other.x;
          const dy = y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = (size + other.size) / 2 + 20;
          if (dist < minDist) {
            overlapping = true;
            break;
          }
        }
        attempts++;
      }

      initialBubbles.push({
        id: index,
        url: img.url,
        x,
        y,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size,
      });
    });

    setBubbles(initialBubbles);
  }, [allMedia, isMobile]);

  // Physics animation loop - optimized for mobile
  useEffect(() => {
    if (bubbles.length === 0) return;

    let animationId: number;

    const animate = () => {
      // Throttle to 30fps on mobile (skip every other frame)
      frameCount.current++;
      if (isMobile && frameCount.current % 2 !== 0) {
        animationId = requestAnimationFrame(animate);
        return;
      }

      setBubbles(prevBubbles => {
        const newBubbles = prevBubbles.map(bubble => ({
          ...bubble,
          x: bubble.x + bubble.vx,
          y: bubble.y + bubble.vy,
          vx: bubble.vx * 0.99, // Friction
          vy: bubble.vy * 0.99,
        }));

        // Wall collision
        newBubbles.forEach(bubble => {
          const radius = bubble.size / 2;
          if (bubble.x - radius < 0) { bubble.x = radius; bubble.vx = Math.abs(bubble.vx) * 0.7; }
          if (bubble.x + radius > window.innerWidth) { bubble.x = window.innerWidth - radius; bubble.vx = -Math.abs(bubble.vx) * 0.7; }
          if (bubble.y - radius < 0) { bubble.y = radius; bubble.vy = Math.abs(bubble.vy) * 0.7; }
          if (bubble.y + radius > window.innerHeight) { bubble.y = window.innerHeight - radius; bubble.vy = -Math.abs(bubble.vy) * 0.7; }
        });

        // Bubble-to-bubble collision - SKIP on mobile for performance
        if (!isMobile) {
          for (let i = 0; i < newBubbles.length; i++) {
            for (let j = i + 1; j < newBubbles.length; j++) {
              const a = newBubbles[i];
              const b = newBubbles[j];
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const minDist = (a.size + b.size) / 2;

              if (dist < minDist && dist > 0) {
                const nx = dx / dist;
                const ny = dy / dist;
                const overlap = minDist - dist;

                a.x -= nx * overlap / 2;
                a.y -= ny * overlap / 2;
                b.x += nx * overlap / 2;
                b.y += ny * overlap / 2;

                const dvx = a.vx - b.vx;
                const dvy = a.vy - b.vy;
                const dvn = dvx * nx + dvy * ny;

                if (dvn > 0) {
                  a.vx -= dvn * nx * 0.8;
                  a.vy -= dvn * ny * 0.8;
                  b.vx += dvn * nx * 0.8;
                  b.vy += dvn * ny * 0.8;
                }
              }
            }
          }
        }

        // Cursor repulsion - only on desktop
        if (!isMobile) {
          const mx = mousePos.current.x;
          const my = mousePos.current.y;
          const repelRadius = 150;
          const repelStrength = 2;

          newBubbles.forEach(bubble => {
            const dx = bubble.x - mx;
            const dy = bubble.y - my;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < repelRadius && dist > 0) {
              const force = (repelRadius - dist) / repelRadius * repelStrength;
              bubble.vx += (dx / dist) * force;
              bubble.vy += (dy / dist) * force;
            }
          });
        }

        // Gentle random drift
        newBubbles.forEach(bubble => {
          bubble.vx += (Math.random() - 0.5) * 0.015;
          bubble.vy += (Math.random() - 0.5) * 0.015;

          // Limit max speed
          const speed = Math.sqrt(bubble.vx * bubble.vx + bubble.vy * bubble.vy);
          const maxSpeed = isMobile ? 1.5 : 3;
          if (speed > maxSpeed) {
            bubble.vx = (bubble.vx / speed) * maxSpeed;
            bubble.vy = (bubble.vy / speed) * maxSpeed;
          }
        });

        return newBubbles;
      });

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [bubbles.length, isMobile]);

  // Track mouse position
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  return (
    <div className="app-container" onMouseMove={handleMouseMove}>
      {/* Physics-based Photo Bubbles Background */}
      <div className="nostalgic-bg" ref={containerRef}>
        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            className="photo-bubble physics-bubble"
            style={{
              width: bubble.size,
              height: bubble.size,
              transform: `translate3d(${bubble.x - bubble.size / 2}px, ${bubble.y - bubble.size / 2}px, 0)`,
            }}
          >
            <img src={bubble.url} alt="" loading="lazy" />
          </div>
        ))}

        {/* Vintage decorative circles */}
        <div className="vintage-circle c1"></div>
        <div className="vintage-circle c2"></div>
        <div className="vintage-circle c3"></div>

        {/* Soft light rays */}
        <div className="light-ray r1"></div>
        <div className="light-ray r2"></div>
      </div>

      <header>
        <div className="header-decoration">✨</div>
        <h1>Life Journey</h1>
        <p className="subtitle">Exploring the chapters of my life, one folder at a time.</p>
        <div className="timeline-decoration">
          <span className="timeline-dot"></span>
          <span className="timeline-line"></span>
          <span className="timeline-dot"></span>
        </div>
      </header>

      {/* Life Stages Navigation Bar - Dynamically Generated */}
      <nav className="life-stages-nav">
        <div className="life-stages-track">
          {/* Home button */}
          <button
            className={`life-stage-btn ${currentPath.length === 0 ? 'active' : ''}`}
            onClick={() => { setCurrentPath([]); setOpenDropdown(null); }}
          >
            <span className="stage-icon">🏠</span>
            <span className="stage-label">Home</span>
          </button>

          {/* Dynamically generated folder buttons */}
          {topLevelFolders.map((folder) => {
            const subfolders = getSubfolders([folder.name]);
            const hasSubfolders = subfolders.length > 0;
            const isActive = currentPath[0] === folder.name;
            const isDropdownOpen = openDropdown === folder.name;

            return (
              <React.Fragment key={folder.name}>
                <div className="stage-connector"></div>

                {hasSubfolders ? (
                  // Folder with subfolders - show dropdown
                  <div className="life-stage-expandable">
                    <button
                      className={`life-stage-btn ${isActive ? 'active' : ''}`}
                      onClick={() => setOpenDropdown(isDropdownOpen ? null : folder.name)}
                    >
                      <span className="stage-icon">📁</span>
                      <span className="stage-label">{folder.name}</span>
                      <span className={`expand-arrow ${isDropdownOpen ? 'open' : ''}`}>▼</span>
                    </button>

                    {/* Dynamic subfolder dropdown */}
                    <div className={`subfolder-dropdown ${isDropdownOpen ? 'show' : ''}`}>
                      <button
                        className={`subfolder-chip ${currentPath.length === 1 && currentPath[0] === folder.name ? 'active' : ''}`}
                        onClick={() => { setCurrentPath([folder.name]); setOpenDropdown(null); }}
                      >
                        📁 All
                      </button>
                      {subfolders.map(subName => (
                        <button
                          key={subName}
                          className={`subfolder-chip ${currentPath[1] === subName ? 'active' : ''}`}
                          onClick={() => { setCurrentPath([folder.name, subName]); setOpenDropdown(null); }}
                        >
                          📂 {subName}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Simple folder without subfolders
                  <button
                    className={`life-stage-btn ${isActive ? 'active' : ''}`}
                    onClick={() => { setCurrentPath([folder.name]); setOpenDropdown(null); }}
                  >
                    <span className="stage-icon">📁</span>
                    <span className="stage-label">{folder.name}</span>
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </nav>

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
