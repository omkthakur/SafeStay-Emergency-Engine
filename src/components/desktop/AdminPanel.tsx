import React, { useState } from 'react';
import { 
  Box, 
  MapPin, 
  Plus, 
  Link as LinkIcon, 
  Cpu, 
  Layout,
  ChevronRight,
  Trash2,
  Flame,
  ShieldAlert,
  Video,
  Wind,
  Maximize,
  Minimize,
  Copy,
  Square,
  RectangleHorizontal,
  Navigation,
  Coffee,
  ArrowUpDown,
  UserCheck,
  ArrowLeft,
  Users,
  Settings,
  ShieldCheck,
  Share2,
  Minus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './AdminPanel.module.css';
import { useEmergencyEngine } from '../../context/EmergencyContext';
import type { NodeType, MapWall, MapZone } from '../../context/EmergencyContext';
import { analyzeSafetyMap, generateMapFromBlueprint } from '../../services/gemini';

const TOOLS: { type: NodeType; icon: any; color: string }[] = [
  { type: 'ROOM', icon: Box, color: '#3b82f6' },
  { type: 'CORRIDOR', icon: Layout, color: '#64748b' },
  { type: 'FIRE_EXIT', icon: ChevronRight, color: '#ef4444' },
  { type: 'STAIRS', icon: Navigation, color: '#e2e8f0' },
  { type: 'ELEVATOR', icon: ArrowUpDown, color: '#ecfeff' },
  { type: 'HIDEOUT', icon: ShieldAlert, color: '#10b981' },
  { type: 'EXTINGUISHER', icon: Flame, color: '#f97316' },
  { type: 'HYDRANT', icon: Wind, color: '#b91c1c' },
  { type: 'CCTV', icon: Video, color: '#8b5cf6' },
  { type: 'QR_ANCHOR', icon: MapPin, color: '#38bdf8' },
  { type: 'SABOTAGE' as any, icon: Flame, color: '#ef4444' },
];

const ZONE_CONFIG: Record<MapZone['type'], { label: string; color: string; icon?: any }> = {
  'ROOM_ZONE': { label: 'Room/Conf', color: '#fef3c7' },
  'CORRIDOR_ZONE': { label: 'Lobby/Hall', color: '#f8fafc' },
  'STAIRS_ZONE': { label: 'Stairs', color: '#e2e8f0' },
  'LOBBY_ZONE': { label: 'Atrium', color: '#f1f5f9' },
  'RESTROOM_ZONE': { label: 'Restroom', color: '#dcfce7', icon: UserCheck },
  'KITCHEN_ZONE': { label: 'Kitchen', color: '#ffedd5', icon: Coffee },
  'ELEVATOR_ZONE': { label: 'Elevator', color: '#ecfeff', icon: ArrowUpDown },
  'OFFICE_ZONE': { label: 'Office', color: '#f5f3ff' },
};

export const AdminPanel: React.FC = () => {
  const navigate = useNavigate();
  const { mapConfig, updateMap, guestDB, sosLogs, floors, activeFloorId, switchFloor, addFloor, simulateVisionImport, updateGuests, pushToCloud, syncStatus, cloudId, engineState, incidentType, triggerHazardAtNode } = useEmergencyEngine();
  const [viewMode, setViewMode] = useState<'DASHBOARD' | 'EDITOR'>('DASHBOARD');
  const [activeTab, setActiveTab] = useState<'MAP' | 'LAYERS' | 'GUESTS' | 'LOGS' | 'SETTINGS'>('MAP');
  const [activeTool, setActiveTool] = useState<'NODE' | 'LINK' | 'DELETE' | 'WALL' | 'ZONE' | 'SABOTAGE'>('NODE');
  const [selectedType, setSelectedType] = useState<NodeType>('ROOM');
  const [zoneType, setZoneType] = useState<MapZone['type']>('ROOM_ZONE');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  
  // Real AI Vision State
  const [blueprint, setBlueprint] = useState<string | null>(null);
  const [isAiScanning, setIsAiScanning] = useState(false);
  
  // Viewport State
  const [zoom, setZoom] = useState(1);
  const [bottlenecks, setBottlenecks] = useState<string[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [draggingId, setDraggingId] = useState<{id: string, type: 'NODE' | 'ZONE'} | null>(null);
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const syncTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-push changes to the "Cloud Database"
  React.useEffect(() => {
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(() => {
        pushToCloud();
    }, 2000); // 2 second debounce to avoid flooding
  }, [mapConfig, engineState, incidentType]);

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggingId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / zoom);
    const y = Math.round((e.clientY - rect.top) / zoom);

    if (draggingId.type === 'NODE') {
      updateMap(mapConfig.nodes.map(n => n.id === draggingId.id ? { ...n, x, y } : n), mapConfig.links, mapConfig.walls, mapConfig.zones);
    } else {
      updateMap(mapConfig.nodes, mapConfig.links, mapConfig.walls, mapConfig.zones.map(z => z.id === draggingId.id ? { ...z, x, y } : z));
    }
  };

  const handleDragStart = (id: string, type: 'NODE' | 'ZONE', e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingId({ id, type });
  };

  const handleCanvasMouseUp = () => {
    setDraggingId(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTab !== 'MAP' || draggingId) return;
    
    // Improved coordinate calculation
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = Math.round((e.clientX - rect.left) / zoom);
    const y = Math.round((e.clientY - rect.top) / zoom);

    // Prevent accidental 0,0 placement if event data is corrupt
    if (x === 0 && y === 0 && e.clientX !== rect.left) return;

    if (activeTool === 'NODE') {
      const id = `n${Date.now()}`;
      updateMap([...mapConfig.nodes, { id, x, y, type: selectedType, label: selectedType }], mapConfig.links, mapConfig.walls, mapConfig.zones);
      setSelectedNodeId(id);
    }

    if (activeTool === 'WALL' || activeTool === 'ZONE') {
      if (!dragStart) {
        setDragStart({ x, y });
      } else {
        if (activeTool === 'WALL') {
          const newWall: MapWall = { id: `w${Date.now()}`, x1: dragStart.x, y1: dragStart.y, x2: x, y2: y };
          updateMap(mapConfig.nodes, mapConfig.links, [...mapConfig.walls, newWall], mapConfig.zones);
        } else {
          const newZone: MapZone = { 
            id: `z${Date.now()}`, 
            x: Math.min(dragStart.x, x), 
            y: Math.min(dragStart.y, y), 
            w: Math.max(20, Math.abs(x - dragStart.x)), 
            h: Math.max(20, Math.abs(y - dragStart.y)), 
            type: zoneType,
            label: ZONE_CONFIG[zoneType].label + ' ' + (mapConfig.zones.length + 1)
          };
          updateMap(mapConfig.nodes, mapConfig.links, mapConfig.walls, [...mapConfig.zones, newZone]);
        }
        setDragStart(null);
      }
    }
  };

  const handleAiVisionScan = async () => {
    setIsAiScanning(true);
    // In a real scenario, we would send the image. For now, we simulate by sending a description of what the user likely wants.
    const result = await generateMapFromBlueprint("A professional office floor with a central corridor, 5 offices on each side, and two fire exits at the ends.");
    if (result) {
        updateMap(result.nodes, result.links, [], result.zones);
    } else {
        simulateVisionImport(); // Fallback to mock
    }
    setIsAiScanning(false);
  };

  const handleBlueprintUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setBlueprint(URL.createObjectURL(file)); }
  };

  const runAIOptimization = async () => {
    setIsAiScanning(true);
    const result = await analyzeSafetyMap(mapConfig);
    setBottlenecks(result.bottlenecks);
    setAiSuggestions(result.suggestions);
    setIsAiScanning(false);
  };

  const exportMap = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ floors, guestDB }));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "safestay_backup.json");
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importMap = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== 'string') return;
        const json = JSON.parse(result);
        if (json.floors) {
          // We need to implement a full updateState in context, for now we just log
          alert("Import successful! Data loaded into persistent engine.");
          window.location.reload(); // Quick way to let root context reload from storage
          localStorage.setItem('SAFESTAY_PERSISTENT_DATA', JSON.stringify({ ...json, activeFloorId: json.floors[0].id, sosLogs: [] }));
        }
      } catch (e) {
        alert("Invalid backup file.");
      }
    };
    reader.readAsText(file);
  };

  const handleNodeClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = mapConfig.nodes.find(n => n.id === id);
    if (!node) return;

    setSelectedNodeId(id);
    setSelectedZoneId(null);

    const isNonNavigable = ['EXTINGUISHER', 'HYDRANT', 'CCTV', 'QR_ANCHOR'].includes(node.type);

    if (activeTool === 'SABOTAGE') {
      triggerHazardAtNode(id);
      setSelectedNodeId(null);
      return;
    }

    if (activeTool === 'DELETE') {
      updateMap(mapConfig.nodes.filter(n => n.id !== id), mapConfig.links.filter(l => l.source !== id && l.target !== id), mapConfig.walls, mapConfig.zones);
      setSelectedNodeId(null);
      return;
    }
    
    if (activeTool === 'LINK') {
      if (isNonNavigable) {
        alert(`${node.type} cannot be part of a navigation route. It is a standalone relief asset.`);
        return;
      }
      if (selectedNodeId && selectedNodeId !== id) {
        const sourceNode = mapConfig.nodes.find(n => n.id === selectedNodeId);
        if (sourceNode && ['EXTINGUISHER', 'HYDRANT', 'CCTV', 'QR_ANCHOR'].includes(sourceNode.type)) {
            setSelectedNodeId(id); // Shift selection to the new core node
            return;
        }
        updateMap(mapConfig.nodes, [...mapConfig.links, { source: selectedNodeId, target: id }], mapConfig.walls, mapConfig.zones);
        setSelectedNodeId(null);
      }
    }
  };

  const handleZoneClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedZoneId(id);
    setSelectedNodeId(null);
    if (activeTool === 'DELETE') {
      updateMap(mapConfig.nodes, mapConfig.links, mapConfig.walls, mapConfig.zones.filter(z => z.id !== id));
      setSelectedZoneId(null);
    }
  };

  const updateZoneLabel = (label: string) => {
    if (!selectedZoneId) return;
    updateMap(mapConfig.nodes, mapConfig.links, mapConfig.walls, mapConfig.zones.map(z => z.id === selectedZoneId ? { ...z, label } : z));
  };

  const updateZoneProperty = (prop: keyof MapZone, value: any) => {
    if (!selectedZoneId) return;
    updateMap(mapConfig.nodes, mapConfig.links, mapConfig.walls, mapConfig.zones.map(z => z.id === selectedZoneId ? { ...z, [prop]: value } : z));
  };

  const clearCurrentFloor = () => {
    if (window.confirm("Are you sure you want to clear this entire floor?")) {
      updateMap([], [], [], []);
      setBlueprint(null);
    }
  };

  const selectedZone = mapConfig.zones.find(z => z.id === selectedZoneId);

  if (viewMode === 'DASHBOARD') {
    return (
        <div className={styles.adminContainer} style={{display: 'flex', flexDirection: 'column', padding: 60, alignItems: 'center', justifyContent: 'center', background: '#050505'}}>
            <div style={{textAlign: 'center', marginBottom: 60}}>
                <div style={{width: 64, height: 64, background: '#38bdf8', borderRadius: 16, margin: '0 auto 20px'}} />
                <h1 style={{fontSize: 32, fontWeight: 900, letterSpacing: -1}}>SafeStay Master Console</h1>
                <p style={{opacity: 0.5, fontSize: 14}}>Architectural Control & Emergency Response Platform</p>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 300px)', gap: 24, maxWidth: 1000}}>
                <div onClick={() => { setViewMode('EDITOR'); setActiveTab('MAP'); }} 
                    style={{background: '#1e293b', border: '1px solid #334155', padding: 40, borderRadius: 24, cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s'}}>
                    <Layout size={48} color="#38bdf8" style={{margin: '0 auto 20px'}} />
                    <h3 style={{fontSize: 18, marginBottom: 10}}>Architecture Editor</h3>
                    <p style={{fontSize: 12, color: '#64748b'}}>Design floorplans, place safety equipment, and map routes.</p>
                </div>

                <div onClick={() => { setViewMode('EDITOR'); setActiveTab('GUESTS'); }} 
                    style={{background: '#1e293b', border: '1px solid #334155', padding: 40, borderRadius: 24, cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s'}}>
                    <Users size={48} color="#38bdf8" style={{margin: '0 auto 20px'}} />
                    <h3 style={{fontSize: 18, marginBottom: 10}}>Guest Management</h3>
                    <p style={{fontSize: 12, color: '#64748b'}}>View registry, update room status, and prioritize rescue.</p>
                </div>

                <div onClick={() => navigate('/staff')} 
                    style={{background: '#1e293b', border: '1px solid #334155', padding: 40, borderRadius: 24, cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s'}}>
                    <ShieldCheck size={48} color="#ef4444" style={{margin: '0 auto 20px'}} />
                    <h3 style={{fontSize: 18, marginBottom: 10}}>Security Dashboard</h3>
                    <p style={{fontSize: 12, color: '#64748b'}}>Live CCTV feeds, incident reports, and emergency dispatch.</p>
                </div>

                <div onClick={() => { setViewMode('EDITOR'); setActiveTab('LOGS'); }} 
                    style={{background: '#1e293b', border: '1px solid #334155', padding: 40, borderRadius: 24, cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s'}}>
                    <Box size={48} color="#94a3b8" style={{margin: '0 auto 20px'}} />
                    <h3 style={{fontSize: 18, marginBottom: 10}}>Incident Logs</h3>
                    <p style={{fontSize: 12, color: '#64748b'}}>Review historical data and safety performance metrics.</p>
                </div>

                <div onClick={() => navigate('/sabotage')} 
                    style={{background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: 40, borderRadius: 24, cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s'}}>
                    <Flame size={48} color="#ef4444" style={{margin: '0 auto 20px', animation: 'pulse 1s infinite'}} />
                    <h3 style={{fontSize: 18, marginBottom: 10, color: '#ef4444'}}>Sabotage Terminal</h3>
                    <p style={{fontSize: 12, color: '#666'}}>Simulate fire, power loss, or breaches to test AI rerouting.</p>
                </div>

                <div onClick={() => { setViewMode('EDITOR'); setActiveTab('SETTINGS'); }} 
                    style={{background: '#1e293b', border: '1px solid #334155', padding: 40, borderRadius: 24, cursor: 'pointer', textAlign: 'center', transition: 'all 0.3s'}}>
                    <Settings size={48} color="#94a3b8" style={{margin: '0 auto 20px'}} />
                    <h3 style={{fontSize: 18, marginBottom: 10}}>System Settings</h3>
                    <p style={{fontSize: 12, color: '#64748b'}}>Configure auto-alarm protocols and database syncing.</p>
                </div>
            </div>
            
            <div style={{marginTop: 60, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(56, 189, 248, 0.05)', padding: '12px 24px', borderRadius: 100, border: '1px solid rgba(56, 189, 248, 0.2)'}}>
                <div style={{width: 8, height: 8, background: '#10b981', borderRadius: '50%'}} />
                <span style={{fontSize: 10, color: '#38bdf8', fontWeight: 900, textTransform: 'uppercase'}}>Autonomous Safety Engine Active</span>
            </div>
        </div>
    );
  }

  return (
    <div className={styles.adminContainer}>
      <div className={styles.sidebar}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20}}>
           <button onClick={() => setViewMode('DASHBOARD')} style={{background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', transition: 'transform 0.2s'}} className="hover-scale"><ArrowLeft size={20}/></button>
           <div><h2 style={{fontSize: 14, fontWeight: 900}}>{activeTab === 'MAP' ? 'Architecture' : activeTab}</h2><p style={{fontSize: 9, opacity: 0.5}}>ACTIVE MODE</p></div>
           <div style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4}}>
              <div style={{width: 6, height: 6, background: '#10b981', borderRadius: '50%'}} />
              <span style={{fontSize: 8, color: '#10b981', fontWeight: 800}}>LIVE</span>
           </div>
        </div>

        {activeTab === 'MAP' && (
          <>
            <div className={styles.toolSection}>
                <p className={styles.toolTitle}><Layout size={10}/> Floor Context</p>
                <div style={{display: 'flex', gap: 5, marginBottom: 8}}>
                    <select value={activeFloorId} onChange={(e) => switchFloor(e.target.value)} className={styles.floorSelect} style={{flex: 1, background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: 8, borderRadius: 8, fontSize: 11}}>
                        {floors.map(f => ( <option key={f.id} value={f.id}>{f.name}</option> ))}
                    </select>
                    <button onClick={() => addFloor(`Floor ${floors.length + 1}`)} className={styles.toolBtn} style={{padding: '0 12px'}} title="Add Floor"><Plus size={14}/></button>
                    <button onClick={clearCurrentFloor} className={styles.toolBtn} style={{padding: '0 12px', color: '#ef4444'}} title="Reset Floor"><Trash2 size={14}/></button>
                </div>
            </div>

            <div className={styles.toolSection}>
                <p className={styles.toolTitle}><Layout size={10}/> Drafting Toolbox</p>
                <div className={styles.toolGrid} style={{background: '#1e293b', padding: 4, borderRadius: 12}}>
                    <button onClick={() => setActiveTool('NODE')} className={`${styles.toolBtn} ${activeTool === 'NODE' ? styles.active : ''}`}><MapPin size={18}/></button>
                    <button onClick={() => setActiveTool('LINK')} className={`${styles.toolBtn} ${activeTool === 'LINK' ? styles.active : ''}`}><Share2 size={18}/></button>
                    <button onClick={() => setActiveTool('WALL')} className={`${styles.toolBtn} ${activeTool === 'WALL' ? styles.active : ''}`}><Minus size={18}/></button>
                    <button onClick={() => setActiveTool('ZONE')} className={`${styles.toolBtn} ${activeTool === 'ZONE' ? styles.active : ''}`}><Square size={18}/></button>
                    <button onClick={() => setActiveTool('SABOTAGE')} className={`${styles.toolBtn} ${activeTool === 'SABOTAGE' ? styles.active : ''}`} style={{background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444'}} title="Among Us Sabotage"><Flame size={18}/></button>
                    <button onClick={() => setActiveTool('DELETE')} className={`${styles.toolBtn} ${activeTool === 'DELETE' ? styles.active : ''}`} style={{color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)'}}><Trash2 size={18}/></button>
                </div>
            </div>

            <div className={styles.toolSection}>
                <p className={styles.toolTitle}><Cpu size={10}/> Smart Vision</p>
                <button onClick={handleAiVisionScan} className={styles.aiBtn} disabled={isAiScanning} style={{width: '100%', marginBottom: 5}}>
                    {isAiScanning ? 'SCANNING...' : 'AUTO-GENERATE'}
                </button>
                <button onClick={runAIOptimization} className={styles.aiBtn} style={{width: '100%', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', fontSize: 9}}>
                    AUDIT EXITS
                </button>
            </div>
          </>
        )}

        {activeTab === 'MAP' && (
           <div style={{ height: 'calc(100vh - 300px)', overflowY: 'auto', paddingRight: 5 }}>
            <div className={styles.toolSection}>
                <p className={styles.toolTitle}><Cpu size={10}/> AI Offline Engine</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input type="file" id="blueprint-upload" hidden onChange={handleBlueprintUpload} accept="image/*" />
                    <button className={styles.toolBtn} style={{width: '100%'}} onClick={() => document.getElementById('blueprint-upload')?.click()}><Plus size={14}/> LOAD FLOORPLAN</button>
                    {blueprint && <button className={styles.aiBtn} onClick={handleAiVisionScan} disabled={isAiScanning}><Cpu size={14}/> {isAiScanning ? 'GENERATING...' : 'AUTO-GENERATE'}</button>}
                </div>
            </div>

            <div className={styles.toolSection}>
                <p className={styles.toolTitle}>Structure Tools</p>
                <div className={styles.toolGrid}>
                    <div className={`${styles.toolBtn} ${activeTool === 'ZONE' ? styles.active : ''}`} onClick={() => setActiveTool('ZONE')}><RectangleHorizontal size={14}/> Block</div>
                    <div className={`${styles.toolBtn} ${activeTool === 'WALL' ? styles.active : ''}`} onClick={() => setActiveTool('WALL')}><Square size={14}/> Wall</div>
                    <div className={`${styles.toolBtn} ${activeTool === 'NODE' ? styles.active : ''}`} onClick={() => setActiveTool('NODE')}><Plus size={14}/> Logic Node</div>
                    <div className={`${styles.toolBtn} ${activeTool === 'LINK' ? styles.active : ''}`} onClick={() => setActiveTool('LINK')}><LinkIcon size={14}/> Route</div>
                    <div className={`${styles.toolBtn} ${activeTool === 'DELETE' ? styles.active : ''}`} onClick={() => setActiveTool('DELETE')}><Trash2 size={14}/> Erase</div>
                </div>
            </div>

            {activeTool === 'ZONE' && (
                <div className={styles.toolSection}>
                    <p className={styles.toolTitle}>Block Type</p>
                    <div className={styles.toolGrid}>
                        {(Object.keys(ZONE_CONFIG) as MapZone['type'][]).map(type => (
                            <div key={type} className={`${styles.toolBtn} ${zoneType === type ? styles.active : ''}`} style={{fontSize: 9}} onClick={() => setZoneType(type)}>{ZONE_CONFIG[type].label}</div>
                        ))}
                    </div>
                </div>
            )}

            <div className={styles.toolSection}>
                <p className={styles.toolTitle}>Hardware Assets</p>
                <div className={styles.toolGrid}>
                    {TOOLS.map((t) => ( <div key={t.type} className={`${styles.toolBtn} ${selectedType === t.type ? styles.active : ''}`} onClick={() => setSelectedType(t.type)}><t.icon size={14}/> {t.type.split('_')[0]}</div> ))}
                </div>
            </div>
           </div>
        )}

        {activeTab === 'LAYERS' && (
           <div style={{ height: 'calc(100vh - 300px)', overflowY: 'auto', paddingRight: 5 }}>
              <p className={styles.toolTitle}>Architectural Layers</p>
              {mapConfig.zones.map(z => (
                  <div key={z.id} onClick={() => { setSelectedZoneId(z.id); setSelectedNodeId(null); }} 
                    style={{ background: selectedZoneId === z.id ? 'rgba(56, 189, 248, 0.15)' : '#1e293b', border: selectedZoneId === z.id ? '1px solid #38bdf8' : '1px solid #334155', padding: '10px 12px', borderRadius: 8, marginBottom: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{width: 12, height: 12, background: ZONE_CONFIG[z.type].color, borderRadius: 3, border: '1px solid rgba(0,0,0,0.1)'}} />
                      <div style={{fontSize: 10, fontWeight: 700}}>{z.label || z.type}</div>
                  </div>
              ))}
              
              <p className={styles.toolTitle} style={{marginTop: 20}}>Logical Entities</p>
              {mapConfig.nodes.map(n => {
                  const tool = TOOLS.find(t => t.type === n.type) || TOOLS[0];
                  return (
                    <div key={n.id} onClick={() => { setSelectedNodeId(n.id); setSelectedZoneId(null); }} 
                      style={{ background: selectedNodeId === n.id ? 'rgba(56, 189, 248, 0.15)' : '#1e293b', border: selectedNodeId === n.id ? '1px solid #38bdf8' : '1px solid #334155', padding: '10px 12px', borderRadius: 8, marginBottom: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <tool.icon size={12} color="#38bdf8" />
                        <div style={{fontSize: 10, fontWeight: 700}}>{n.label || n.type}</div>
                        <div style={{fontSize: 8, color: '#64748b', marginLeft: 'auto'}}>ID: {n.id.slice(0,5)}</div>
                    </div>
                  );
              })}
           </div>
        )}

        {aiSuggestions.length > 0 && ( <div style={{marginTop: 'auto', padding: 12, background: 'rgba(255,59,48,0.1)', borderRadius: 8, border: '1px solid #ef4444', marginBottom: 12}}><h4 style={{fontSize: 10, color: '#ef4444', marginBottom: 8}}>AI SAFETY REPORT</h4><div style={{maxHeight: 120, overflowY: 'auto', fontSize: 9, color: '#94a3b8'}}>{aiSuggestions.map((s, i) => <div key={i} style={{marginBottom: 6}}>• {s}</div>)}</div></div> )}
        <div className={styles.aiActions}><button className={styles.aiBtn} onClick={runAIOptimization}><Cpu size={16}/> RUN SAFETY AUDIT</button></div>
      </div>

      <div className={styles.workflow}>
        {activeTab === 'MAP' ? (
          <div className={styles.canvasContainer}>
            <div ref={canvasRef} className={styles.canvas} 
              style={{ transform: `scale(${zoom})`, background: blueprint ? `url(${blueprint})` : '#0f172a', backgroundSize: 'cover', backgroundPosition: 'center', filter: isAiScanning ? 'brightness(0.2) grayscale(1)' : 'none' }} 
              onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp}
              onClick={handleCanvasClick}>
              
              <svg style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none'}}>
                <defs>
                   <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                     <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.1)" />
                   </pattern>
                   <pattern id="stairs" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
                     <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(0,0,0,0.1)" strokeWidth="5" />
                   </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
                {mapConfig.zones?.map((zone) => (
                   <g key={zone.id} onMouseDown={(e) => handleDragStart(zone.id, 'ZONE', e)} onClick={(e) => handleZoneClick(zone.id, e)} style={{pointerEvents: 'all', cursor: 'grab'}}>
                     <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} 
                      fill={selectedZoneId === zone.id ? 'rgba(56, 189, 248, 0.3)' : zone.type === 'STAIRS_ZONE' ? 'url(#stairs)' : ZONE_CONFIG[zone.type].color} 
                      stroke={selectedZoneId === zone.id ? '#38bdf8' : 'rgba(0,0,0,0.1)'} strokeWidth={2} />
                     {zone.label && <text x={zone.x + 5} y={zone.y + 15} fill="#0f172a" fontSize="10" fontWeight="900" style={{pointerEvents: 'none'}}>{zone.label}</text>}
                   </g>
                ))}
                {mapConfig.walls?.map((wall) => ( <line key={wall.id} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} stroke="#1e293b" strokeWidth={6} strokeLinecap="round" /> ))}
                {mapConfig.links.map((link, i) => {
                    const s = mapConfig.nodes.find(n => n.id === link.source);
                    const t = mapConfig.nodes.find(n => n.id === link.target);
                    return s && t ? <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#38bdf8" strokeWidth={3} strokeDasharray="5 5" opacity="0.4" /> : null;
                })}
              </svg>

              {mapConfig.nodes.map((node) => {
                const tool = TOOLS.find(t => t.type === node.type) || TOOLS[0];
                return (
                  <div key={node.id} className={`${styles.node} ${styles['node' + node.type]}`}
                    style={{ left: node.x, top: node.y, border: selectedNodeId === node.id ? '2px solid #fff' : (bottlenecks.includes(node.id) ? '2px solid #ef4444' : 'none'), boxShadow: bottlenecks.includes(node.id) ? '0 0 10px #ef4444' : 'none', cursor: 'grab' }}
                    onMouseDown={(e) => handleDragStart(node.id, 'NODE', e)}
                    onClick={(e) => handleNodeClick(node.id, e)}><tool.icon size={10} color="#fff" /></div>
                );
              })}
            </div>
            <div className={styles.zoomControls}>
                <button className={styles.zoomBtn} onClick={() => setZoom(prev => Math.min(prev + 0.2, 3))}><Maximize size={20}/></button>
                <button className={styles.zoomBtn} onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.2))}><Minimize size={20}/></button>
            </div>
          </div>
        ) : activeTab === 'GUESTS' ? (
          <div style={{padding: 40, width: '100%', color: '#fff'}}><h3 style={{color: '#38bdf8', marginBottom: 20}}>Guest Registry</h3>
             <div style={{marginBottom: 20}}>
                <button onClick={() => updateGuests([...guestDB, { id: `g${Date.now()}`, name: "New Guest", room: "Unassigned", count: 1, tags: [], priority: 'MEDIUM' }])} 
                    style={{padding: '10px 20px', background: '#38bdf8', color: '#0f172a', borderRadius: 8, border: 'none', fontWeight: 900, cursor: 'pointer'}}>+ ADD GUEST</button>
             </div>
             <table style={{width: '100%', borderCollapse: 'collapse', background: '#1e293b', border: '1px solid #334155'}}>
              <thead style={{background: '#0f172a'}}><tr><th style={{padding: 12, textAlign: 'left'}}>NAME</th><th style={{textAlign: 'left'}}>ROOM</th><th style={{textAlign: 'left'}}>STATUS</th><th style={{textAlign: 'left'}}>ACTION</th></tr></thead>
              <tbody>{guestDB.map(g => ( <tr key={g.id} style={{borderBottom: '1px solid #334155'}}><td style={{padding: 12}}>{g.name}</td><td>{g.room}</td><td style={{color: '#34C759'}}>ACTIVE</td><td><button style={{color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer'}} onClick={() => updateGuests(guestDB.filter(x => x.id !== g.id))}>REMOVE</button></td></tr> ))}</tbody>
            </table>
          </div>
        ) : activeTab === 'SETTINGS' ? (
          <div style={{padding: 40, width: '100%', color: '#fff'}}><h3 style={{color: '#38bdf8', marginBottom: 20}}>System Settings</h3>
             <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30}}>
                <div style={{background: '#1e293b', padding: 25, borderRadius: 16, border: '1px solid #334155'}}>
                    <h4 style={{marginBottom: 15, color: '#94a3b8'}}>Cloud Cluster Sync</h4>
                    <p style={{fontSize: 11, color: '#64748b', marginBottom: 20}}>Connect multiple devices to this project using your Unique Sync ID.</p>
                    
                    <div style={{background: '#0f172a', padding: 15, borderRadius: 10, marginBottom: 20, border: '1px solid #334155'}}>
                        <div style={{fontSize: 9, color: '#94a3b8', marginBottom: 5}}>YOUR SYNC ID (HACKATHON CLUSTER)</div>
                        <div style={{fontSize: 14, fontWeight: 900, color: '#38bdf8', letterSpacing: 2}}>
                           {cloudId}
                        </div>
                    </div>

                    <button onClick={() => pushToCloud()} className={styles.aiBtn} style={{width: '100%', background: '#34d399', color: '#059669', fontWeight: 900, marginBottom: 15}}>
                       {syncStatus === 'SYNCING' ? 'PUSHING DATA...' : 'PUSH TO CLUSTER'}
                    </button>

                    <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'rgba(56, 189, 248, 0.05)', borderRadius: 8}}>
                        <div style={{width: 8, height: 8, background: '#10b981', borderRadius: '50%'}} />
                        <div style={{fontSize: 10, fontWeight: 800}}>SYNC ENGINE: ONLINE</div>
                    </div>
                </div>
                <div style={{background: '#1e293b', padding: 25, borderRadius: 16, border: '1px solid #334155'}}>
                    <h4 style={{marginBottom: 15, color: '#94a3b8'}}>Database Backup</h4>
                    <p style={{fontSize: 11, color: '#64748b', marginBottom: 20}}>Download a physical JSON backup of your building configuration.</p>
                    <div style={{display: 'flex', gap: 10, marginBottom: 20}}>
                        <button onClick={exportMap} className={styles.toolBtn} style={{flex: 1, fontSize: 10, background: '#38bdf8', color: '#0f172a', fontWeight: 900}}><Copy size={12}/> EXPORT JSON</button>
                        <input type="file" id="import-map" hidden onChange={importMap} accept=".json" />
                        <button onClick={() => document.getElementById('import-map')?.click()} className={styles.toolBtn} style={{flex: 1, fontSize: 10}}><Plus size={12}/> IMPORT JSON</button>
                    </div>
                </div>
             </div>
          </div>
        ) : (
          <div style={{padding: 40, width: '100%', color: '#fff'}}><h3 style={{color: '#ef4444', marginBottom: 20}}>Incident logs</h3>
            {sosLogs.map((log, i) => ( <div key={i} style={{background: '#1e293b', padding: 16, borderRadius: 8, marginBottom: 12, border: '1px solid #334155', borderLeft: '4px solid #ef4444', display: 'flex', justifyContent: 'space-between'}}><div><div style={{fontWeight: 900}}>{log.event}</div><div style={{fontSize: 11, color: '#94a3b8'}}>Node: {log.nodeId}</div></div><div style={{color: '#38bdf8', fontSize: 12}}>{log.timestamp}</div></div> ))}
          </div>
        )}
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.header}><h2 style={{fontSize: 14, fontWeight: 900}}>Inspector</h2><p style={{fontSize: 9, opacity: 0.5}}>PROPERTY EDITOR</p></div>
        {selectedZone ? (
             <div style={{background: 'rgba(56, 189, 248, 0.05)', padding: 16, borderRadius: 12, border: '1px solid #38bdf8'}}>
                <div style={{fontSize: 9, color: '#38bdf8', marginBottom: 4}}>BLOCK TYPE: {selectedZone.type}</div>
                <input type="text" value={selectedZone.label || ''} onChange={(e) => updateZoneLabel(e.target.value)} style={{width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: 8, borderRadius: 4, outline: 'none', marginBottom: 12}} placeholder="Enter label..." />
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 15}}>
                    <div><label style={{fontSize: 8, color: '#94a3b8'}}>WIDTH (PX)</label><input type="number" value={selectedZone.w} onChange={(e) => updateZoneProperty('w', parseInt(e.target.value))} style={{width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: 5, borderRadius: 4}} /></div>
                    <div><label style={{fontSize: 8, color: '#94a3b8'}}>HEIGHT (PX)</label><input type="number" value={selectedZone.h} onChange={(e) => updateZoneProperty('h', parseInt(e.target.value))} style={{width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: 5, borderRadius: 4}} /></div>
                    <div><label style={{fontSize: 8, color: '#94a3b8'}}>POS X</label><input type="number" value={selectedZone.x} onChange={(e) => updateZoneProperty('x', parseInt(e.target.value))} style={{width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: 5, borderRadius: 4}} /></div>
                    <div><label style={{fontSize: 8, color: '#94a3b8'}}>POS Y</label><input type="number" value={selectedZone.y} onChange={(e) => updateZoneProperty('y', parseInt(e.target.value))} style={{width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: 5, borderRadius: 4}} /></div>
                </div>
                <div style={{display: 'flex', gap: 5}}>
                    <button onClick={() => updateMap(mapConfig.nodes, mapConfig.links, mapConfig.walls, mapConfig.zones.filter(z => z.id !== selectedZoneId))} style={{background: '#ef4444', color: '#fff', flex: 1, padding: 8, borderRadius: 4, fontSize: 10, fontWeight: 800}}>DELETE</button>
                    <button onClick={() => setSelectedZoneId(null)} style={{background: '#334155', color: '#fff', flex: 1, padding: 8, borderRadius: 4, fontSize: 10}}>CLOSE</button>
                </div>
             </div>
        ) : selectedNodeId ? (
            <div style={{background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid #38bdf8'}}>
                <h4 style={{fontSize: 12, color: '#38bdf8', marginBottom: 12}}>ENTITY: {selectedNodeId}</h4>
                <button className={styles.aiBtn} onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/?nodeId=${selectedNodeId}`); alert('Copied!'); }} style={{width: '100%', background: '#38bdf8', color: '#0f172a'}}><Copy size={14}/> DEPLOYMENT LINK</button>
            </div>
        ) : <div style={{opacity: 0.3, textAlign: 'center', marginTop: 100}}><Navigation size={48} /><p style={{fontSize: 12}}>Select a floor or block.</p></div>}
      </div>
    </div>
  );
};
