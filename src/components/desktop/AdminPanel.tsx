import React, { useState, useRef } from 'react';
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
  Minus,
  Download,
  Upload,
  RotateCcw,
  Clock,
  Eye,
  EyeOff,
  Hand,
  RefreshCcw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './AdminPanel.module.css';
import { useEmergencyEngine } from '../../context/EmergencyContext';
import type { NodeType, MapWall, MapNode, MapZone } from '../../context/EmergencyContext';

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
  const { mapConfig, updateMap, analyzeExits, guestDB, sosLogs, saveToDisk, floors, activeFloorId, switchFloor, addFloor, updateGuests, pushToCloud, syncStatus, cloudId, engineState, incidentType, triggerHazardAtNode, undoMap, canUndo, forceRestoreFromDisk, wipeLogs, resolveIncident } = useEmergencyEngine();
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'DASHBOARD' | 'EDITOR'>('DASHBOARD');
  const [activeTab, setActiveTab] = useState<'MAP' | 'LAYERS' | 'GUESTS' | 'LOGS' | 'SETTINGS'>('MAP');
  const [activeTool, setActiveTool] = useState<'NODE' | 'LINK' | 'DELETE' | 'WALL' | 'ZONE' | 'SABOTAGE' | 'PAN'>('PAN');
  const [selectedType, setSelectedType] = useState<NodeType>('ROOM');
  const [zoneType, setZoneType] = useState<MapZone['type']>('ROOM_ZONE');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [newGuest, setNewGuest] = useState({ name: '', room: '', count: 1, priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' });
  
  const [blueprint, setBlueprint] = useState<string | null>(null);
  const [showBlueprint, setShowBlueprint] = useState(true);
  const [mapLayer, setMapLayer] = useState<'MANUAL' | 'AI'>('MANUAL');
  const [aiMapData, setAiMapData] = useState<typeof mapConfig | null>(null);
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({x: 0, y: 0});
  const [isPanning, setIsPanning] = useState(false);
  const [bottlenecks, setBottlenecks] = useState<string[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [draggingId, setDraggingId] = useState<{id: string, type: 'NODE' | 'ZONE'} | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const syncTimeout = useRef<any>(null);

  const activeMapData = mapLayer === 'AI' && aiMapData ? aiMapData : mapConfig;

  React.useEffect(() => {
    const loadAiData = async () => {
        // Try Cloud first
        try {
            const { doc, getDoc } = await import('firebase/firestore');
            const { db } = await import('../../services/firebase');
            const snap = await getDoc(doc(db, "safestay_buildings", cloudId));
            if (snap.exists() && snap.data().aiMapData) {
                console.log("🤖 AI Map loaded from Cloud");
                setAiMapData(snap.data().aiMapData);
                return;
            }
        } catch (e) {}

        // Fallback to local file
        fetch('/data/ai_map_data.json')
          .then(res => res.json())
          .then(data => {
            if (data && data.nodes) {
              setAiMapData(data);
            }
          })
          .catch(() => console.log('No existing AI map data found'));
    };
    loadAiData();
  }, [cloudId]);

  React.useEffect(() => {
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(() => {
        pushToCloud();
    }, 2000);
  }, [mapConfig, engineState, incidentType]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'PAN') {
      setIsPanning(true);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan(prev => ({ x: prev.x + e.movementX / zoom, y: prev.y + e.movementY / zoom }));
      return;
    }
    if (!draggingId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / zoom);
    const y = Math.round((e.clientY - rect.top) / zoom);

    if (draggingId.type === 'NODE') {
      updateMap(prev => ({ ...prev, nodes: prev.nodes.map(n => n.id === draggingId.id ? { ...n, x, y } : n) }));
    } else {
      updateMap(prev => ({ ...prev, zones: prev.zones.map(z => z.id === draggingId.id ? { ...z, x, y } : z) }));
    }
  };

  const handleDragStart = (id: string, type: 'NODE' | 'ZONE', e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingId({ id, type });
  };

  const handleCanvasMouseUp = () => {
    setDraggingId(null);
    setIsPanning(false);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTab !== 'MAP' || draggingId) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round((e.clientX - rect.left) / zoom);
    const y = Math.round((e.clientY - rect.top) / zoom);

    if (x === 0 && y === 0 && e.clientX !== rect.left) return;

    if (activeTool === 'NODE') {
      const id = `n${Date.now()}`;
      updateMap(prev => ({ ...prev, nodes: [...prev.nodes, { id, x, y, type: selectedType, label: selectedType }] }));
      setSelectedNodeId(id);
    }

    if (activeTool === 'WALL' || activeTool === 'ZONE') {
      if (!dragStart) {
        setDragStart({ x, y });
      } else {
        if (activeTool === 'WALL') {
          const newWall: MapWall = { id: `w${Date.now()}`, x1: dragStart.x, y1: dragStart.y, x2: x, y2: y };
          updateMap(prev => ({ ...prev, walls: [...prev.walls, newWall] }));
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
          updateMap(prev => ({ ...prev, zones: [...prev.zones, newZone] }));
        }
        setDragStart(null);
      }
    }
  };


  const handleBlueprintUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { 
        setBlueprint(URL.createObjectURL(file)); 
        setIsAiScanning(true);
        
        try {
            const base64Image = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.readAsDataURL(file);
            });

            const prompt = `Analyze this floorplan. You need to map out the architectural geometry.
Return a JSON object EXACTLY matching this structure:
{
  "nodes": [{"id": "n1", "type": "ROOM", "x": 500, "y": 600, "label": "Office 1"}],
  "zones": [{"id": "z1", "type": "ROOM_ZONE", "x": 400, "y": 500, "w": 200, "h": 200, "label": "Office Area"}],
  "links": [{"source": "n1", "target": "n2"}],
  "walls": []
}
Rules: Coordinate system 0-3000. Identify rooms, exits, and paths.`;

            const response = await fetch('/api/scan-blueprint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Image, prompt })
            });

            if (!response.ok) throw new Error('AI Proxy Error');
            
            const data = await response.json();
            const responseText = data.text.trim().replace(/```json/gi, '').replace(/```/g, '');
            const aiData = JSON.parse(responseText);
            
            setAiMapData({
                nodes: aiData.nodes || [],
                zones: aiData.zones || [],
                walls: aiData.walls || [],
                links: aiData.links || []
            });
            setMapLayer('AI');
        } catch (err) {
            console.error("Gemini AI Mapping Failed:", err);
            alert("AI Analysis failed. Please try manual drafting.");
        } finally {
            setIsAiScanning(false);
        }
    }
  };

  const auditAllExits = () => {
    const { bottlenecks, suggestions } = analyzeExits();
    setBottlenecks(bottlenecks);
    setAiSuggestions(suggestions);
  };

  const runSafetyAuditAI = async () => {
    setIsAuditing(true);
    setAiSuggestions(['Initializing Gemini Safety Assessment...']);
    
    try {
        const mapPayload = {
            nodes: activeMapData.nodes.map(n => ({ id: n.id, type: n.type, label: n.label })),
            zones: activeMapData.zones.map(z => ({ id: z.id, type: z.type, label: z.label })),
            links: activeMapData.links
        };

        const prompt = `You are a Life Safety Engineer auditing an emergency evacuation map.
Analyze this map: ${JSON.stringify(mapPayload)}
Return a JSON object with "bottlenecks" (node IDs) and "suggestions" (strings).`;

        const response = await fetch('/api/scan-blueprint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) throw new Error('AI Proxy Error');
        
        const data = await response.json();
        const responseText = data.text.trim().replace(/```json/gi, '').replace(/```/g, '');
        const aiData = JSON.parse(responseText);
        
        setBottlenecks(aiData.bottlenecks || []);
        setAiSuggestions(aiData.suggestions || ["Audit complete: No severe issues found."]);
    } catch (err) {
        console.error("AI Audit failed:", err);
        setAiSuggestions(["AI Audit system currently offline. Please review manually."]);
    } finally {
        setIsAuditing(false);
    }
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

  const forceReloadFromFiles = () => {
    if (window.confirm("This will wipe your browser cache and reload everything from the map_data.json and guest_data.json files. Proceed?")) {
      localStorage.removeItem('SAFESTAY_PERSISTENT_DATA');
      window.location.reload();
    }
  };

  const importMap = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.floors) {
          alert("Import successful! Data loaded into persistent engine.");
          window.location.reload();
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
      updateMap(prev => ({ ...prev, nodes: prev.nodes.filter(n => n.id !== id), links: prev.links.filter(l => l.source !== id && l.target !== id) }));
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
            setSelectedNodeId(id);
            return;
        }
        updateMap(prev => ({ ...prev, links: [...prev.links, { source: selectedNodeId, target: id }] }));
        setSelectedNodeId(null);
      }
    }
  };

  const handleZoneClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedZoneId(id);
    setSelectedNodeId(null);
    if (activeTool === 'DELETE') {
      updateMap(prev => ({ ...prev, zones: prev.zones.filter(z => z.id !== id) }));
      setSelectedZoneId(null);
    }
  };

  const updateZoneLabel = (label: string) => {
    if (!selectedZoneId) return;
    updateMap(prev => ({ ...prev, zones: prev.zones.map(z => z.id === selectedZoneId ? { ...z, label } : z) }));
  };

  const updateZoneProperty = (prop: keyof MapZone, value: any) => {
    if (!selectedZoneId) return;
    updateMap(prev => ({ ...prev, zones: prev.zones.map(z => z.id === selectedZoneId ? { ...z, [prop]: value } : z) }));
  };

  const updateNodeProperty = (id: string, prop: keyof MapNode, value: any) => {
    updateMap(prev => ({ ...prev, nodes: prev.nodes.map(n => n.id === id ? { ...n, [prop]: value } : n) }));
  };

  const clearCurrentFloor = () => {
    if (window.confirm("Are you sure you want to clear this entire floor?")) {
      updateMap(prev => ({ ...prev, nodes: [], links: [], walls: [], zones: [] }));
      setBlueprint(null);
    }
  };

  const duplicateEntity = () => {
    if (selectedNodeId) {
      const node = mapConfig.nodes.find(n => n.id === selectedNodeId);
      if (node) {
        const id = `n${Date.now()}`;
        updateMap(prev => ({ ...prev, nodes: [...prev.nodes, { ...node, id, x: node.x + 20, y: node.y + 20 }] }));
        setSelectedNodeId(id);
      }
    } else if (selectedZoneId) {
      const zone = mapConfig.zones.find(z => z.id === selectedZoneId);
      if (zone) {
        const id = `z${Date.now()}`;
        updateMap(prev => ({ ...prev, zones: [...prev.zones, { ...zone, id, x: zone.x + 20, y: zone.y + 20 }] }));
        setSelectedZoneId(id);
      }
    }
  };

  React.useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            duplicateEntity();
        }
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undoMap();
        }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [selectedNodeId, selectedZoneId, mapConfig, canUndo]);

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
        <div style={{display: 'flex', flexDirection: 'column', gap: 15, marginBottom: 20}}>
           <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
              <button onClick={() => setViewMode('DASHBOARD')} className={styles.toolBtn} style={{padding: 6, borderRadius: '50%', width: 28, height: 28}}><ArrowLeft size={14}/></button>
              <h2 style={{fontSize: 14, fontWeight: 900, letterSpacing: -0.5, color: '#38bdf8', margin: 0}}>SafeStay Admin</h2>
              <div style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4}}>
                 <div style={{width: 6, height: 6, background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite'}} />
                 <span style={{fontSize: 8, color: '#10b981', fontWeight: 800}}>LIVE</span>
              </div>
           </div>

           <button onClick={async () => { 
                setIsSaving(true);
                await saveToDisk(aiMapData); 
                setTimeout(() => setIsSaving(false), 1000);
                alert('ARCHITECTURAL DATA COMMITTED TO DISK SUCCESSFUL'); 
             }} className={`${styles.aiBtn} ${styles.commitBtn}`} style={{width: '100%', padding: '10px', position: 'relative', overflow: 'hidden', fontSize: 10}}>
              <ShieldCheck size={14}/> {isSaving ? 'SYNCING...' : 'COMMIT ALL CHANGES'}
              {isSaving && <div style={{position: 'absolute', bottom: 0, left: 0, height: 2, background: '#fff', width: '100%', animation: 'loading 1s linear infinite'}} />}
           </button>
        </div>

        <div style={{ height: 'calc(100vh - 160px)', overflowY: 'auto', paddingRight: 5, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {activeTab === 'MAP' && (
            <>
              <div className={styles.toolSection}>
                  <p className={styles.toolTitle} style={{fontSize: 9}}><Layout size={10}/> Floor Context</p>
                  <div style={{display: 'flex', gap: 5}}>
                      <select value={activeFloorId} onChange={(e) => switchFloor(e.target.value)} className={styles.floorSelect} style={{flex: 1, background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: 6, borderRadius: 8, fontSize: 10}}>
                          {floors.map(f => ( <option key={f.id} value={f.id}>{f.name}</option> ))}
                      </select>
                      <button onClick={() => addFloor(`Floor ${floors.length + 1}`)} className={styles.toolBtn} style={{padding: '0 8px'}} title="Add Floor"><Plus size={12}/></button>
                      <button onClick={clearCurrentFloor} className={styles.toolBtn} style={{padding: '0 8px', color: '#ef4444'}} title="Clear Floor"><Trash2 size={12}/></button>
                  </div>
              </div>

              <div className={styles.toolSection}>
                  <p className={styles.toolTitle} style={{fontSize: 9}}><Layout size={10}/> Drafting Suite</p>
                  <div className={styles.toolGrid} style={{background: '#1e293b', padding: '8px', borderRadius: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px'}}>
                      <button onClick={() => setActiveTool('PAN')} className={`${styles.toolBtn} ${activeTool === 'PAN' ? styles.active : ''}`} style={{fontSize: 9, padding: '10px 5px', flexDirection: 'column', gap: 5}}>
                        <Hand size={14}/> <span>Pan</span>
                      </button>
                      <button onClick={() => setActiveTool('NODE')} className={`${styles.toolBtn} ${activeTool === 'NODE' ? styles.active : ''}`} style={{fontSize: 9, padding: '10px 5px', flexDirection: 'column', gap: 5}}>
                        <MapPin size={14}/> <span>Node</span>
                      </button>
                      <button onClick={() => setActiveTool('LINK')} className={`${styles.toolBtn} ${activeTool === 'LINK' ? styles.active : ''}`} style={{fontSize: 9, padding: '10px 5px', flexDirection: 'column', gap: 5}}>
                        <Share2 size={14}/> <span>Route</span>
                      </button>
                      <button onClick={() => setActiveTool('ZONE')} className={`${styles.toolBtn} ${activeTool === 'ZONE' ? styles.active : ''}`} style={{fontSize: 9, padding: '10px 5px', flexDirection: 'column', gap: 5}}>
                        <Square size={14}/> <span>Block</span>
                      </button>
                      <button onClick={() => setActiveTool('WALL')} className={`${styles.toolBtn} ${activeTool === 'WALL' ? styles.active : ''}`} style={{fontSize: 9, padding: '10px 5px', flexDirection: 'column', gap: 5}}>
                        <Minus size={14}/> <span>Wall</span>
                      </button>
                      <button onClick={() => setActiveTool('SABOTAGE')} className={`${styles.toolBtn} ${activeTool === 'SABOTAGE' ? styles.active : ''}`} style={{fontSize: 9, padding: '10px 5px', flexDirection: 'column', gap: 5, background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)'}}>
                        <Flame size={14}/> <span>Hazard</span>
                      </button>
                      <button onClick={() => setActiveTool('DELETE')} className={`${styles.toolBtn} ${activeTool === 'DELETE' ? styles.active : ''}`} style={{fontSize: 9, padding: '10px 5px', flexDirection: 'column', gap: 5, color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.1)'}}>
                        <Trash2 size={14}/> <span>Erase</span>
                      </button>
                  </div>
                  <div style={{marginTop: 8, display: 'flex', gap: 5}}>
                      <button onClick={undoMap} disabled={!canUndo} className={styles.toolBtn} style={{flex: 1, padding: '8px', opacity: canUndo ? 1 : 0.3, cursor: canUndo ? 'pointer' : 'not-allowed', fontSize: 9}} title="Undo (Ctrl+Z)">
                          <RotateCcw size={12}/> UNDO
                      </button>
                      <button onClick={forceRestoreFromDisk} className={styles.toolBtn} style={{flex: 1.5, padding: '8px', fontSize: 9, color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)'}} title="Restore map from local JSON files">
                          <Download size={12}/> RESTORE FROM DISK
                      </button>
                  </div>
              </div>

              <div className={styles.toolSection}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                    <p className={styles.toolTitle} style={{fontSize: 9, margin: 0}}><Cpu size={10}/> Blueprint Engine</p>
                    <button onClick={() => setShowBlueprint(!showBlueprint)} style={{background: 'none', border: 'none', color: showBlueprint ? '#38bdf8' : '#64748b', cursor: 'pointer', padding: 0, opacity: blueprint ? 1 : 0.3}} title="Toggle Blueprint Visibility">
                        {showBlueprint ? <Eye size={12}/> : <EyeOff size={12}/>}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input type="file" id="blueprint-upload" hidden onChange={handleBlueprintUpload} accept="image/*" />
                      <button className={styles.toolBtn} style={{width: '100%', border: '1px dashed #334155', fontSize: 10}} onClick={() => document.getElementById('blueprint-upload')?.click()}><Plus size={12}/> {isAiScanning ? 'SCANNING...' : 'UPLOAD FLOORPLAN'}</button>
                  </div>
              </div>

              {activeTool === 'ZONE' && (
                  <div className={styles.toolSection}>
                      <p className={styles.toolTitle} style={{fontSize: 9}}>Block Category</p>
                      <div className={styles.toolGrid} style={{gridTemplateColumns: '1fr 1fr'}}>
                          {(Object.keys(ZONE_CONFIG) as MapZone['type'][]).map(type => (
                              <div key={type} className={`${styles.toolBtn} ${zoneType === type ? styles.active : ''}`} style={{fontSize: 8, padding: '6px 2px'}} onClick={() => setZoneType(type)}>{ZONE_CONFIG[type].label}</div>
                          ))}
                      </div>
                  </div>
              )}

              <div className={styles.toolSection}>
                  <p className={styles.toolTitle} style={{fontSize: 9}}>Hardware Assets</p>
                  <div className={styles.toolGrid} style={{gridTemplateColumns: '1fr 1fr 1fr'}}>
                      {TOOLS.map((t) => ( <div key={t.type} className={`${styles.toolBtn} ${selectedType === t.type ? styles.active : ''}`} style={{fontSize: 8, padding: '8px 2px', flexDirection: 'column', gap: 4}} onClick={() => setSelectedType(t.type)}><t.icon size={12}/> <span>{t.type.split('_')[0]}</span></div> ))}
                  </div>
              </div>

              <div className={styles.toolSection}>
                  <p className={styles.toolTitle} style={{fontSize: 9}}><Cpu size={10}/> Safety Audit</p>
                  <button onClick={auditAllExits} className={styles.aiBtn} style={{width: '100%', padding: '10px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)', fontSize: 10}}>
                      <ShieldCheck size={12}/> AUDIT ALL EXITS
                  </button>
              </div>
            </>
          )}

          {activeTab === 'LAYERS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
        </div>

        {aiSuggestions.length > 0 && ( <div style={{marginTop: 'auto', padding: 12, background: 'rgba(255,59,48,0.1)', borderRadius: 8, border: '1px solid #ef4444', marginBottom: 12}}><h4 style={{fontSize: 10, color: '#ef4444', marginBottom: 8}}>AI SAFETY REPORT</h4><div style={{maxHeight: 120, overflowY: 'auto', fontSize: 9, color: '#94a3b8'}}>{aiSuggestions.map((s, i) => <div key={i} style={{marginBottom: 6}}>• {s}</div>)}</div></div> )}
        <div className={styles.aiActions}>
            <button className={styles.aiBtn} onClick={runSafetyAuditAI} disabled={isAuditing} style={{ opacity: isAuditing ? 0.5 : 1 }}>
                <Cpu size={16}/> {isAuditing ? 'ANALYZING...' : 'RUN SAFETY AUDIT'}
            </button>
        </div>
      </div>

      <div className={styles.workflow} style={{flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start'}}>
        <div style={{height: 60, borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', padding: '0 30px', gap: 40, zIndex: 100}}>
           {(['MAP', 'GUESTS', 'LOGS', 'SETTINGS'] as const).map(tab => (
              <div key={tab} onClick={() => setActiveTab(tab)} 
                style={{fontSize: 11, fontWeight: 900, color: (activeTab === tab || (activeTab === 'LAYERS' && tab === 'MAP')) ? '#38bdf8' : '#64748b', cursor: 'pointer', height: '100%', display: 'flex', alignItems: 'center', borderBottom: (activeTab === tab || (activeTab === 'LAYERS' && tab === 'MAP')) ? '2px solid #38bdf8' : 'none', transition: 'all 0.3s', textTransform: 'uppercase', letterSpacing: 1}}>
                 {tab === 'MAP' ? 'Tactical Map' : tab === 'GUESTS' ? 'Guest Registry' : tab === 'LOGS' ? 'Incident Logs' : 'System Settings'}
              </div>
           ))}
        </div>

        {(activeTab === 'MAP' || activeTab === 'LAYERS') ? (
          <div className={styles.canvasContainer}>
                 <div style={{position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', display: 'flex', background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(10px)', padding: 6, borderRadius: 100, border: '1px solid rgba(255,255,255,0.1)', zIndex: 1000, gap: 5}}>
                     <button onClick={() => setMapLayer('MANUAL')} style={{padding: '8px 20px', borderRadius: 100, border: 'none', background: mapLayer === 'MANUAL' ? '#38bdf8' : 'transparent', color: mapLayer === 'MANUAL' ? '#0f172a' : '#94a3b8', fontSize: 10, fontWeight: 900, cursor: 'pointer', transition: 'all 0.3s'}}>MANUAL CONFIG</button>
                     <button onClick={() => setMapLayer('AI')} style={{padding: '8px 20px', borderRadius: 100, border: 'none', background: mapLayer === 'AI' ? '#10b981' : 'transparent', color: mapLayer === 'AI' ? '#0f172a' : '#94a3b8', fontSize: 10, fontWeight: 900, cursor: 'pointer', transition: 'all 0.3s'}}>
                         AI GENERATED {aiMapData === null && <span style={{fontSize: 8, color: '#ef4444', marginLeft: 4}}>(EMPTY)</span>}
                     </button>
                 </div>

            <div ref={canvasRef} className={styles.canvas} 
              style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, background: (blueprint && showBlueprint) ? `url(${blueprint})` : '#0f172a', backgroundSize: 'cover', backgroundPosition: 'center', filter: isAiScanning ? 'brightness(0.2) grayscale(1)' : 'none', cursor: activeTool === 'PAN' ? (isPanning ? 'grabbing' : 'grab') : 'default' }} 
              onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp}
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
                {activeMapData.zones?.map((zone) => (
                   <g key={zone.id} onMouseDown={(e) => handleDragStart(zone.id, 'ZONE', e)} onClick={(e) => handleZoneClick(zone.id, e)} style={{pointerEvents: 'all', cursor: 'grab'}}>
                     <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} 
                      fill={selectedZoneId === zone.id ? 'rgba(56, 189, 248, 0.3)' : zone.type === 'STAIRS_ZONE' ? 'url(#stairs)' : ZONE_CONFIG[zone.type].color} 
                      stroke={selectedZoneId === zone.id ? '#38bdf8' : 'rgba(0,0,0,0.1)'} strokeWidth={2} />
                     {zone.label && <text x={zone.x + 5} y={zone.y + 15} fill="#0f172a" fontSize="10" fontWeight="900" style={{pointerEvents: 'none'}}>{zone.label}</text>}
                   </g>
                ))}
                {activeMapData.walls?.map((wall) => ( <line key={wall.id} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} stroke="#1e293b" strokeWidth={6} strokeLinecap="round" /> ))}
                {activeMapData.links.map((link, i) => {
                    const s = activeMapData.nodes.find(n => n.id === link.source);
                    const t = activeMapData.nodes.find(n => n.id === link.target);
                    return s && t ? <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#38bdf8" strokeWidth={3} strokeDasharray="5 5" opacity="0.4" /> : null;
                })}
              </svg>

              {activeMapData.nodes.map((node) => {
                const tool = TOOLS.find(t => t.type === node.type) || TOOLS[0];
                return (
                  <div key={node.id} className={`${styles.node} ${styles['node' + node.type]}`}
                    style={{ left: node.x, top: node.y, border: selectedNodeId === node.id ? '2px solid #fff' : (bottlenecks.includes(node.id) ? '2px solid #ef4444' : 'none'), boxShadow: bottlenecks.includes(node.id) ? '0 0 10px #ef4444' : 'none', cursor: 'grab' }}
                    onMouseDown={(e) => handleDragStart(node.id, 'NODE', e)}
                    onClick={(e) => handleNodeClick(node.id, e)}>
                      <tool.icon size={10} color="#fff" />
                      {node.label && (
                        <div style={{ position: 'absolute', top: 25, left: '50%', transform: 'translateX(-50%)', background: 'rgba(15, 23, 42, 0.8)', padding: '2px 6px', borderRadius: 4, fontSize: 8, color: '#fff', whiteSpace: 'nowrap', pointerEvents: 'none', border: '1px solid rgba(255,255,255,0.1)' }}>
                          {node.label}
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
            <div className={styles.zoomControls}>
                <button className={styles.zoomBtn} onClick={() => setZoom(prev => Math.min(prev + 0.2, 3))}><Maximize size={20}/></button>
                <button className={styles.zoomBtn} onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.2))}><Minimize size={20}/></button>
            </div>
          </div>
        ) : activeTab === 'GUESTS' ? (
          <div style={{padding: 40, width: '100%', color: '#fff', display: 'flex', flexDirection: 'column', gap: 30}}>
             <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                   <h2 style={{fontSize: 28, fontWeight: 900, letterSpacing: -1, color: '#38bdf8', marginBottom: 5}}>Guest Registry</h2>
                   <p style={{fontSize: 12, color: '#94a3b8'}}>Active monitoring of all building occupants.</p>
                </div>
                <button onClick={() => setIsGuestModalOpen(true)} 
                    className={styles.aiBtn} style={{padding: '12px 24px', background: '#38bdf8', color: '#0f172a', borderRadius: 12, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10}}>
                    <Plus size={18}/> REGISTER NEW GUEST
                </button>
             </div>

             {/* GUEST REGISTRATION MODAL */}
             {isGuestModalOpen && (
               <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)'}}>
                  <div style={{width: '100%', maxWidth: 500, background: '#0f172a', border: '1px solid #334155', borderRadius: 24, padding: 30, boxShadow: '0 0 50px rgba(0,0,0,0.5)'}}>
                     <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25}}>
                        <h3 style={{fontSize: 22, fontWeight: 900, margin: 0}}>Guest Registration</h3>
                        <button onClick={() => setIsGuestModalOpen(false)} style={{background: 'none', border: 'none', color: '#64748b', cursor: 'pointer'}}><Trash2 size={20}/></button>
                     </div>

                     <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                        <div>
                           <label style={{fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 8}}>FULL NAME / GROUP NAME</label>
                           <input type="text" value={newGuest.name} onChange={(e) => setNewGuest({...newGuest, name: e.target.value})} placeholder="e.g. John Doe / Alpha Team" style={{width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: 12, borderRadius: 10, outline: 'none'}} />
                        </div>

                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15}}>
                           <div>
                              <label style={{fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 8}}>ROOM / ASSIGNMENT</label>
                              <input type="text" value={newGuest.room} onChange={(e) => setNewGuest({...newGuest, room: e.target.value})} placeholder="Room 302" style={{width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: 12, borderRadius: 10, outline: 'none'}} />
                           </div>
                           <div>
                              <label style={{fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 8}}>HEAD COUNT</label>
                              <input type="number" value={newGuest.count} onChange={(e) => setNewGuest({...newGuest, count: parseInt(e.target.value) || 1})} style={{width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: 12, borderRadius: 10, outline: 'none'}} />
                           </div>
                        </div>

                        <div>
                           <label style={{fontSize: 10, color: '#94a3b8', display: 'block', marginBottom: 8}}>EVACUATION PRIORITY</label>
                           <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10}}>
                              {(['LOW', 'MEDIUM', 'HIGH'] as const).map(p => (
                                 <button key={p} onClick={() => setNewGuest({...newGuest, priority: p})} 
                                    style={{padding: '10px', borderRadius: 8, border: '1px solid #334155', background: newGuest.priority === p ? (p === 'HIGH' ? '#ef4444' : '#38bdf8') : '#1e293b', color: newGuest.priority === p ? '#000' : '#fff', fontSize: 10, fontWeight: 900, cursor: 'pointer'}}>
                                    {p}
                                 </button>
                              ))}
                           </div>
                        </div>

                        <div style={{marginTop: 10, display: 'flex', gap: 10}}>
                           <button onClick={() => setIsGuestModalOpen(false)} style={{flex: 1, padding: 15, background: '#1e293b', border: '1px solid #334155', borderRadius: 12, color: '#fff', fontWeight: 800, cursor: 'pointer'}}>CANCEL</button>
                           <button 
                              onClick={() => {
                                 if (!newGuest.name || !newGuest.room) return alert('Please fill all fields');
                                 updateGuests([...guestDB, { ...newGuest, id: `g${Date.now()}`, tags: [] }]);
                                 setIsGuestModalOpen(false);
                                 setNewGuest({ name: '', room: '', count: 1, priority: 'MEDIUM' });
                              }}
                              style={{flex: 2, padding: 15, background: '#38bdf8', border: 'none', borderRadius: 12, color: '#0f172a', fontWeight: 900, cursor: 'pointer'}}>
                              CONFIRM REGISTRATION
                           </button>
                        </div>
                     </div>
                  </div>
               </div>
             )}

             <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20}}>
                <div style={{background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: 20, borderRadius: 16}}>
                   <div style={{fontSize: 10, color: '#38bdf8', fontWeight: 900, marginBottom: 5}}>TOTAL OCCUPANCY</div>
                   <div style={{fontSize: 32, fontWeight: 900}}>{guestDB.length}</div>
                </div>
                <div style={{background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: 20, borderRadius: 16}}>
                   <div style={{fontSize: 10, color: '#10b981', fontWeight: 900, marginBottom: 5}}>STATUS: SECURE</div>
                   <div style={{fontSize: 32, fontWeight: 900, color: '#10b981'}}>{guestDB.length}</div>
                </div>
                <div style={{background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: 20, borderRadius: 16}}>
                   <div style={{fontSize: 10, color: '#ef4444', fontWeight: 900, marginBottom: 5}}>MISSING / SOS</div>
                   <div style={{fontSize: 32, fontWeight: 900, color: '#ef4444'}}>0</div>
                </div>
                <div style={{background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: 20, borderRadius: 16}}>
                   <div style={{fontSize: 10, color: '#94a3b8', fontWeight: 900, marginBottom: 5}}>SYNC STATUS</div>
                   <div style={{fontSize: 12, fontWeight: 800, marginTop: 15, display: 'flex', alignItems: 'center', gap: 6}}>
                      <div style={{width: 8, height: 8, background: '#10b981', borderRadius: '50%'}} /> CLUSTER CONNECTED
                   </div>
                </div>
             </div>

             <div style={{background: '#1e293b', padding: 15, borderRadius: 16, border: '1px solid #334155', display: 'flex', gap: 15, alignItems: 'center'}}>
                <div style={{position: 'relative', flex: 1}}>
                   <MapPin size={16} style={{position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: '#64748b'}} />
                   <input type="text" placeholder="Search guests by name, room, or ID..." style={{width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '12px 15px 12px 45px', borderRadius: 10, outline: 'none', fontSize: 13}} />
                </div>
                <div style={{display: 'flex', gap: 10}}>
                   <button className={styles.toolBtn} style={{padding: '10px 15px', fontSize: 11}}><Users size={14}/> ALL FLOORS</button>
                   <button className={styles.toolBtn} style={{padding: '10px 15px', fontSize: 11}}><ShieldCheck size={14}/> VERIFIED ONLY</button>
                </div>
             </div>

             <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20, maxHeight: 'calc(100vh - 450px)', overflowY: 'auto', paddingRight: 10}}>
                {guestDB.map(g => (
                   <div key={g.id} style={{background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: 20, position: 'relative', transition: 'all 0.3s', borderLeft: `4px solid ${g.priority === 'HIGH' ? '#ef4444' : '#38bdf8'}`}}>
                      <div style={{display: 'flex', gap: 15, alignItems: 'center', marginBottom: 15}}>
                         <div style={{width: 50, height: 50, background: '#0f172a', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#38bdf8'}}>
                            {g.name.charAt(0)}
                         </div>
                         <div style={{flex: 1}}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                               <h4 style={{margin: 0, fontSize: 16, fontWeight: 800}}>{g.name}</h4>
                               <div style={{fontSize: 9, padding: '3px 8px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderRadius: 100, fontWeight: 800}}>{g.priority}</div>
                            </div>
                            <div style={{fontSize: 11, color: '#64748b'}}>ID: {g.id.slice(-8).toUpperCase()}</div>
                         </div>
                      </div>

                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 20}}>
                         <div style={{background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 12}}>
                            <div style={{fontSize: 8, color: '#64748b', marginBottom: 4}}>ROOM / ZONE</div>
                            <div style={{fontSize: 12, fontWeight: 700}}>{g.room}</div>
                         </div>
                         <div style={{background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 12}}>
                            <div style={{fontSize: 8, color: '#64748b', marginBottom: 4}}>HEAD COUNT</div>
                            <div style={{fontSize: 12, fontWeight: 700}}>{g.count} Persons</div>
                         </div>
                      </div>

                      <div style={{display: 'flex', gap: 10}}>
                         <button style={{flex: 1, padding: '8px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 800, cursor: 'pointer'}}>EDIT DATA</button>
                         <button onClick={() => updateGuests(guestDB.filter(x => x.id !== g.id))} style={{padding: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: 8, cursor: 'pointer'}}><Trash2 size={14}/></button>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        ) : activeTab === 'SETTINGS' ? (
          <div style={{padding: 40, width: '100%', color: '#fff'}}><h2 style={{fontSize: 28, fontWeight: 900, color: '#38bdf8', marginBottom: 20}}>System Settings</h2>
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
                        <button onClick={exportMap} className={styles.toolBtn} style={{flex: 1, fontSize: 10, background: '#38bdf8', color: '#0f172a', fontWeight: 900}}><Download size={12}/> EXPORT JSON</button>
                        <input type="file" id="import-map" hidden onChange={importMap} accept=".json" />
                        <button onClick={() => document.getElementById('import-map')?.click()} className={styles.toolBtn} style={{flex: 1, fontSize: 10}}><Upload size={12}/> IMPORT JSON</button>
                    </div>

                    <h4 style={{marginBottom: 15, marginTop: 30, color: '#94a3b8'}}>Physical Storage (Modular JSON)</h4>
                    <p style={{fontSize: 11, color: '#64748b', marginBottom: 20}}>Force a sync with the src/data JSON files or completely reload from them.</p>
                    <div style={{display: 'flex', gap: 10}}>
                        <button onClick={() => { saveToDisk(); alert('Commit request sent to physical server.'); }} className={styles.toolBtn} style={{flex: 1, fontSize: 10, background: '#10b981', color: '#fff', fontWeight: 900, border: 'none'}}>COMMIT CHANGES TO DISK</button>
                        <button onClick={forceReloadFromFiles} className={styles.toolBtn} style={{flex: 1, fontSize: 10, background: '#ef4444', color: '#fff', fontWeight: 900, border: 'none'}}>RELOAD FROM MASTER FILES</button>
                    </div>
                </div>
             </div>
          </div>
        ) : (
          <div style={{padding: 40, width: '100%', color: '#fff', display: 'flex', flexDirection: 'column', gap: 30}}>
             <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                   <h2 style={{fontSize: 28, fontWeight: 900, letterSpacing: -1, color: '#ef4444', marginBottom: 5}}>Black Box: Incident Logs</h2>
                   <p style={{fontSize: 12, color: '#94a3b8'}}>Permanent immutable record of building security events.</p>
                </div>
                <div style={{display: 'flex', gap: 10}}>
                   <button onClick={() => alert('Exporting log data to encrypted CSV...')} className={styles.toolBtn} style={{padding: '12px 20px', borderRadius: 12, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8}}><Download size={16}/> EXPORT LOGS</button>
                   <button onClick={() => { if(confirm('Are you sure you want to wipe all logs?')) wipeLogs(); }} className={styles.toolBtn} style={{padding: '12px 20px', borderRadius: 12, fontSize: 11, fontWeight: 800, color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)'}}><Trash2 size={16}/> WIPE RECORD</button>
                </div>
             </div>

             <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20}}>
                <div style={{background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: 20, borderRadius: 16}}>
                   <div style={{fontSize: 10, color: '#ef4444', fontWeight: 900, marginBottom: 5}}>TOTAL INCIDENTS</div>
                   <div style={{fontSize: 32, fontWeight: 900}}>{sosLogs.length}</div>
                </div>
                <div style={{background: 'rgba(251, 191, 36, 0.05)', border: '1px solid rgba(251, 191, 36, 0.2)', padding: 20, borderRadius: 16}}>
                   <div style={{fontSize: 10, color: '#fbbf24', fontWeight: 900, marginBottom: 5}}>UNRESOLVED</div>
                   <div style={{fontSize: 32, fontWeight: 900, color: '#fbbf24'}}>{sosLogs.filter(l => l.status === 'ACTIVE').length}</div>
                </div>
                <div style={{background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: 20, borderRadius: 16}}>
                   <div style={{fontSize: 10, color: '#38bdf8', fontWeight: 900, marginBottom: 5}}>SYSTEM AUDITS</div>
                   <div style={{fontSize: 32, fontWeight: 900, color: '#38bdf8'}}>14</div>
                </div>
                <div style={{background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: 20, borderRadius: 16}}>
                   <div style={{fontSize: 10, color: '#94a3b8', fontWeight: 900, marginBottom: 5}}>RECORDER STATUS</div>
                   <div style={{fontSize: 12, fontWeight: 800, marginTop: 15, display: 'flex', alignItems: 'center', gap: 6}}>
                      <div style={{width: 8, height: 8, background: '#ef4444', borderRadius: '50%', animation: 'pulse 1s infinite'}} /> RECORDING LIVE
                   </div>
                </div>
             </div>

             <div style={{flex: 1, overflowY: 'auto', paddingRight: 10, display: 'flex', flexDirection: 'column', gap: 15, maxHeight: 'calc(100vh - 400px)'}}>
                {sosLogs.length === 0 ? (
                    <div style={{textAlign: 'center', padding: 100, opacity: 0.3}}>
                        <ShieldCheck size={64} style={{marginBottom: 20}}/>
                        <p>No incidents recorded in current session.</p>
                    </div>
                ) : (
                    [...sosLogs].reverse().map((log, i) => {
                        const eventName = log.event || 'UNKNOWN INCIDENT';
                        const isHazard = eventName.includes('FIRE') || eventName.includes('HAZARD');
                        const isResolved = log.status === 'RESOLVED';
                        return (
                           <div key={i} style={{background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: '20px 25px', display: 'flex', alignItems: 'center', gap: 20, transition: 'all 0.3s', opacity: isResolved ? 0.6 : 1, borderLeft: `4px solid ${isHazard ? '#ef4444' : '#38bdf8'}`}}>
                              <div style={{width: 45, height: 45, background: isHazard ? 'rgba(239, 68, 68, 0.1)' : 'rgba(56, 189, 248, 0.1)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isHazard ? '#ef4444' : '#38bdf8'}}>
                                 {isHazard ? <Flame size={20}/> : <ShieldAlert size={20}/>}
                              </div>
                              
                              <div style={{flex: 1}}>
                                 <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5}}>
                                    <h4 style={{margin: 0, fontSize: 15, fontWeight: 900, color: isHazard ? '#ef4444' : '#f1f5f9'}}>{eventName}</h4>
                                    <span style={{fontSize: 9, background: isResolved ? '#334155' : 'rgba(16, 185, 129, 0.1)', color: isResolved ? '#94a3b8' : '#10b981', padding: '2px 8px', borderRadius: 100, fontWeight: 800}}>
                                       {isResolved ? 'RESOLVED' : 'ACTIVE THREAT'}
                                    </span>
                                 </div>
                                 <div style={{fontSize: 11, color: '#64748b', display: 'flex', gap: 15}}>
                                    <span style={{display: 'flex', alignItems: 'center', gap: 4}}><MapPin size={10}/> {mapConfig.nodes.find(n => n.id === log.nodeId)?.label || log.nodeId || 'Unknown Location'}</span>
                                    <span style={{display: 'flex', alignItems: 'center', gap: 4}}><Clock size={10}/> {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'Unknown Time'}</span>
                                 </div>
                              </div>

                              <div style={{textAlign: 'right', display: 'flex', gap: 10}}>
                                 {!isResolved && (
                                    <button onClick={() => resolveIncident(log.id)} style={{background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '8px 16px', borderRadius: 8, fontSize: 10, fontWeight: 900, cursor: 'pointer'}}>MARK RESOLVED</button>
                                 )}
                                 <button style={{background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 10, fontWeight: 900, cursor: 'pointer'}}>INVESTIGATE</button>
                              </div>
                           </div>
                        );
                    })
                )}
             </div>
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
                    <button onClick={duplicateEntity} style={{background: '#1e293b', color: '#fff', flex: 1, padding: 8, borderRadius: 4, fontSize: 10, fontWeight: 800, border: '1px solid #334155', cursor: 'pointer'}}>DUPLICATE</button>
                    <button onClick={() => updateMap(prev => ({ ...prev, zones: prev.zones.filter(z => z.id !== selectedZoneId) }))} style={{background: '#ef4444', color: '#fff', flex: 1, padding: 8, borderRadius: 4, fontSize: 10, fontWeight: 800, border: 'none', cursor: 'pointer'}}>DELETE</button>
                    <button onClick={() => setSelectedZoneId(null)} style={{background: '#334155', color: '#fff', flex: 1, padding: 8, borderRadius: 4, fontSize: 10, border: 'none', cursor: 'pointer'}}>CLOSE</button>
                </div>
             </div>
        ) : selectedNodeId ? (
            <div style={{background: 'rgba(56, 189, 248, 0.05)', padding: 16, borderRadius: 12, border: '1px solid #38bdf8'}}>
                <h4 style={{fontSize: 12, color: '#38bdf8', marginBottom: 12}}>ENTITY: {selectedNodeId}</h4>
                
                <div style={{marginBottom: 15}}>
                    <label style={{fontSize: 8, color: '#94a3b8', display: 'block', marginBottom: 4}}>NODE LABEL</label>
                    <input type="text" 
                        value={mapConfig.nodes.find(n => n.id === selectedNodeId)?.label || ''} 
                        onChange={(e) => updateNodeProperty(selectedNodeId, 'label', e.target.value)} 
                        style={{width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: 8, borderRadius: 4, outline: 'none'}} 
                        placeholder="e.g. Room 301, North Exit..." />
                </div>

                <div style={{marginBottom: 15}}>
                    <label style={{fontSize: 8, color: '#94a3b8', display: 'block', marginBottom: 4}}>ASSET TYPE</label>
                    <select 
                        value={mapConfig.nodes.find(n => n.id === selectedNodeId)?.type || 'ROOM'} 
                        onChange={(e) => updateNodeProperty(selectedNodeId, 'type', e.target.value as NodeType)} 
                        style={{width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: 8, borderRadius: 4, outline: 'none', fontSize: 11}}>
                        {TOOLS.map(t => <option key={t.type} value={t.type}>{t.type}</option>)}
                    </select>
                </div>

                <div style={{marginBottom: 15}}>
                    <label style={{fontSize: 8, color: '#94a3b8', display: 'block', marginBottom: 4}}>DESCRIPTION / NOTES</label>
                    <textarea 
                        value={mapConfig.nodes.find(n => n.id === selectedNodeId)?.description || ''} 
                        onChange={(e) => updateNodeProperty(selectedNodeId, 'description', e.target.value)} 
                        style={{width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: 8, borderRadius: 4, outline: 'none', height: 60, resize: 'none'}} 
                        placeholder="Additional details about this location..." />
                </div>

                <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
                    <button className={styles.aiBtn} onClick={duplicateEntity} style={{width: '100%', background: '#1e293b', border: '1px solid #334155'}}><Copy size={14}/> DUPLICATE NODE</button>
                    <button className={styles.aiBtn} onClick={() => { 
                        const url = `${window.location.origin}/?nodeId=${selectedNodeId}`;
                        window.open(url, '_blank');
                    }} style={{width: '100%', background: '#38bdf8', color: '#0f172a'}}>
                        <Maximize size={14}/> PREVIEW ON MAP
                    </button>
                    <button className={styles.aiBtn} onClick={() => { 
                        navigator.clipboard.writeText(`${window.location.origin}/?nodeId=${selectedNodeId}`); 
                        alert('Link copied to clipboard!'); 
                    }} style={{width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #334155'}}>
                        <Copy size={14}/> COPY LINK
                    </button>
                    <button onClick={() => updateMap(prev => ({ ...prev, nodes: prev.nodes.filter(n => n.id !== selectedNodeId), links: prev.links.filter(l => l.source !== selectedNodeId && l.target !== selectedNodeId) }))} style={{background: '#ef4444', color: '#fff', width: '100%', padding: 12, borderRadius: 12, fontSize: 10, fontWeight: 800, border: 'none', cursor: 'pointer'}}>DELETE NODE</button>
                    <button onClick={() => setSelectedNodeId(null)} style={{background: '#334155', color: '#fff', width: '100%', padding: 8, borderRadius: 8, fontSize: 10, border: 'none', cursor: 'pointer'}}>CLOSE</button>
                </div>
            </div>
        ) : <div style={{opacity: 0.3, textAlign: 'center', marginTop: 100}}><Navigation size={48} /><p style={{fontSize: 12}}>Select a floor or block.</p></div>}
      </div>
    </div>
  );
};
