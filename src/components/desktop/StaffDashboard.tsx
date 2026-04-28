import React, { useState } from 'react';
import { Video, Users, CheckCircle, Maximize, Minimize, ShieldAlert, Activity, Eye, RefreshCcw, Database, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEmergencyEngine } from '../../context/EmergencyContext';



export const StaffDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { 
    engineState, guestDB, 
    mapConfig, hazardZones, resetSystem, activeGuests, sosLogs, 
    syncStatus, pullFromCloud, cloudId, pendingIncident, confirmIncident, resolveIncident 
  } = useEmergencyEngine();
  
  // Default Tactical Viewport
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(0.35);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartPos({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const isEmergency = engineState !== 'IDLE' && engineState !== 'THREAT_DETECTED';
  // const activeAlerts = sosLogs.filter(l => l.status === 'ACTIVE');

  return (
    <div style={{ 
      width: '100vw', height: '100vh', backgroundColor: '#020617', color: '#f8fafc',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      
      {/* --- LAYER 1: COMMAND OVERLAY (Critical Triage) --- */}
      {pendingIncident && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          zIndex: 1000, backgroundColor: 'rgba(2, 6, 23, 0.98)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }}>
          <div style={{
            width: '100%', maxWidth: 1000, backgroundColor: '#0f172a', borderRadius: 24,
            border: `3px solid ${pendingIncident.type === 'MEDICAL' ? '#38bdf8' : '#ef4444'}`,
            boxShadow: `0 0 100px ${pendingIncident.type === 'MEDICAL' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            overflow: 'hidden'
          }}>
            <div style={{ padding: '25px 40px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  {pendingIncident.type === 'MEDICAL' ? <Activity size={40} color="#38bdf8" /> : <ShieldAlert size={40} color="#ef4444" />}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', letterSpacing: 2 }}>SECURITY INTERCEPT</div>
                    <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>{pendingIncident.subtype?.toUpperCase() || pendingIncident.type} REPORTED</h2>
                  </div>
               </div>
               <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>ORIGIN</div>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{mapConfig.nodes.find(n => n.id === pendingIncident.nodeId)?.label || pendingIncident.nodeId}</div>
               </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, padding: 30 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                 <div style={{ background: '#1e293b', padding: 25, borderRadius: 16, border: '1px solid #334155' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                       <Eye size={14} /> GEMINI AI VISION ASSESSMENT
                    </div>
                    <p style={{ fontSize: 16, lineHeight: 1.5, color: '#fff', margin: 0 }}>"{pendingIncident.aiVerification.aiAssessment}"</p>
                    <div style={{ marginTop: 20, padding: '10px 15px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                       <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>AI CONFIDENCE</span>
                       <span style={{ fontSize: 16, fontWeight: 900, color: '#38bdf8' }}>{(pendingIncident.aiVerification.confidence * 100).toFixed(0)}%</span>
                    </div>
                 </div>
                 <div style={{ display: 'flex', gap: 15 }}>
                    <button onClick={() => confirmIncident(pendingIncident.id, true)} style={{ flex: 2, padding: 20, background: pendingIncident.type === 'MEDICAL' ? '#38bdf8' : '#ef4444', color: '#000', border: 'none', borderRadius: 12, fontWeight: 900, fontSize: 16, cursor: 'pointer' }}>DEPLOY PERSONNEL</button>
                    <button onClick={() => confirmIncident(pendingIncident.id, false)} style={{ flex: 1, padding: 20, background: '#334155', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 900, fontSize: 16, cursor: 'pointer' }}>DISMISS</button>
                 </div>
              </div>
              <div style={{ background: '#000', borderRadius: 16, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <Video size={48} color="rgba(255,255,255,0.05)" />
                 <div style={{ position: 'absolute', top: 15, left: 15, color: '#ef4444', fontSize: 10, fontWeight: 900, animation: 'pulse 1s infinite' }}>• LIVE CCTV_CONTEXT</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TOP BAR --- */}
      <div style={{ height: 70, background: '#0f172a', borderBottom: '2px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
          <ShieldAlert size={32} color={isEmergency ? '#ef4444' : '#38bdf8'} />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: 2 }}>SAFESTAY COMMAND</h1>
        </div>
        
        <div style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
           <div style={{ background: '#1e293b', padding: '8px 15px', borderRadius: 8, display: 'flex', gap: 15 }}>
              <div style={{ textAlign: 'right' }}>
                 <div style={{ fontSize: 9, color: '#94a3b8' }}>SYSTEM</div>
                 <div style={{ fontSize: 14, fontWeight: 800, color: isEmergency ? '#ef4444' : '#10b981' }}>{engineState}</div>
              </div>
              <div style={{ textAlign: 'right', borderLeft: '1px solid #334155', paddingLeft: 15 }}>
                 <div style={{ fontSize: 9, color: '#94a3b8' }}>DB SYNC</div>
                 <div style={{ fontSize: 14, fontWeight: 800, color: '#38bdf8' }}>{syncStatus}</div>
              </div>
           </div>
           {isEmergency && <button onClick={resetSystem} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 900, cursor: 'pointer' }}>RESET SYSTEM</button>}
           <button onClick={() => navigate('/admin')} style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid #38bdf8', color: '#38bdf8', padding: '10px 20px', borderRadius: 8, fontWeight: 900, cursor: 'pointer' }}>ADMIN CONSOLE</button>
           <button onClick={() => pullFromCloud(cloudId)} style={{ background: '#334155', color: '#fff', border: 'none', padding: '10px', borderRadius: 8, cursor: 'pointer' }}><Database size={18} /></button>
        </div>
      </div>

      {/* --- MAIN GRID --- */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '340px 1fr 340px', background: '#1e293b', gap: 1 }}>
        
        {/* Left Panel: Tactical Event Logs */}
        <div style={{ background: '#0f172a', display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e293b', minHeight: 0 }}>
          <div style={{ padding: '20px 25px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
               <List size={16} color="#38bdf8" />
               <span style={{ fontSize: 11, fontWeight: 900, color: '#f8fafc', letterSpacing: 1 }}>TACTICAL EVENT LOGS</span>
            </div>
            <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
                <button 
                  onClick={() => navigate('/logs')}
                  style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '4px 8px', borderRadius: 4, fontSize: 9, fontWeight: 900, cursor: 'pointer' }}
                >
                  OPEN ARCHIVE
                </button>
                <button 
                  onClick={() => {
                    if(confirm("Confirm system-wide log reset?")) {
                      resetSystem(); // This clears everything including logs
                    }
                  }}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 9, fontWeight: 900 }}
                >
                  CLEAR ALL
                </button>
            </div>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 15 }}>
            {sosLogs.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: 100, opacity: 0.3 }}>
                <CheckCircle size={40} style={{ marginBottom: 15, color: '#10b981' }} />
                <div style={{ fontSize: 12 }}>System Status: Operational</div>
                <div style={{ fontSize: 10, marginTop: 5 }}>No critical events logged.</div>
              </div>
            ) : (
              [...sosLogs].reverse().map((alert, i) => (
                <div key={i} style={{ 
                  padding: 18, background: 'rgba(255,255,255,0.02)', borderRadius: 12, 
                  border: `1px solid ${alert.event.includes('FIRE') || alert.event.includes('THREAT') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)'}`,
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: alert.event.includes('CONFIRMED') ? '#10b981' : '#ef4444' }}>
                      {alert.event}
                    </span>
                    <span style={{ fontSize: 9, color: '#64748b' }}>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', marginBottom: 5 }}>
                    {mapConfig.nodes.find(n => n.id === alert.nodeId)?.label || alert.nodeId}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4, marginBottom: 10 }}>
                    {alert.description || "System generated emergency event."}
                  </div>
                  {alert.status === 'ACTIVE' && (
                    <button 
                      onClick={() => resolveIncident(alert.id)}
                      style={{ width: '100%', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', padding: '6px', borderRadius: 6, fontSize: 10, fontWeight: 900, cursor: 'pointer' }}
                    >
                      MARK AS RESOLVED
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tactical Map Viewport (High Visibility) */}
        <div 
          style={{ background: '#020617', position: 'relative', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
          onWheel={(e) => {
            if (e.deltaY < 0) {
              setZoom(prev => Math.min(prev + 0.1, 3));
            } else {
              setZoom(prev => Math.max(prev - 0.1, 0.05));
            }
          }}
        >
          <svg style={{ flex: 1, width: '100%', height: '100%', cursor: isDragging ? 'grabbing' : 'grab' }}>
            <g style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
               {/* 1. Architectural Zones (DATABASE DRIVEN) */}
               {mapConfig.zones?.map((zone) => (
                 <rect 
                  key={zone.id} x={zone.x} y={zone.y} width={zone.w} height={zone.h} 
                  fill="#1e293b" stroke="#334155" strokeWidth={5/zoom} opacity="0.8"
                 />
               ))}
               
               {/* 2. Hallway Connectivity */}
               {mapConfig.links.map((link, i) => {
                 const s = mapConfig.nodes.find(n => n.id === link.source);
                 const t = mapConfig.nodes.find(n => n.id === link.target);
                 if (!s || !t) return null;
                 return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#334155" strokeWidth={30/zoom} strokeLinecap="round" />;
               })}

               {/* 3. Logical Nodes (Rooms/Stations) */}
               {mapConfig.nodes.map((node) => (
                 <g key={node.id}>
                    <rect 
                      x={node.x - 30} y={node.y - 30} width={60} height={60} rx={6}
                      fill={node.isHazard ? '#ef4444' : '#0f172a'} 
                      stroke="#475569" strokeWidth={2/zoom}
                    />
                    <text x={node.x} y={node.y + 5} textAnchor="middle" fill="#fff" style={{ fontSize: '14px', fontWeight: 900, pointerEvents: 'none' }}>
                      {node.label || node.id}
                    </text>
                    {node.isHazard && (
                      <circle cx={node.x} cy={node.y} r={50} fill="#ef4444" opacity={0.2}>
                         <animate attributeName="r" values="40;60;40" dur="1s" repeatCount="indefinite" />
                      </circle>
                    )}
                 </g>
               ))}

               {/* 4. Real-time Hazard Zones */}
               {hazardZones.map((hz, i) => (
                 <circle key={i} cx={hz.cx} cy={hz.cy} r={hz.r} fill="#ef4444" opacity="0.15">
                    <animate attributeName="opacity" values="0.1;0.3;0.1" dur="2s" repeatCount="indefinite" />
                 </circle>
               ))}

               {/* 5. Live Guest Radar */}
               {activeGuests.map((guest) => {
                  const node = mapConfig.nodes.find(n => n.id === guest.nodeId);
                  if (!node) return null;
                  return (
                    <g key={guest.id} transform={`translate(${node.x}, ${node.y})`}>
                      <circle r={40/zoom} fill="#10b981" opacity={0.3} style={{ animation: 'pulse 1.5s infinite' }} />
                      <circle r={12/zoom} fill="#10b981" stroke="#fff" strokeWidth={4/zoom} />
                    </g>
                  );
               })}
            </g>
          </svg>

          {/* Map Controls */}
          <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 1000 }}>
             <button onClick={() => { setPan({x: 100, y: 100}); setZoom(0.35); }} style={{ padding: '10px 15px', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid #334155', borderRadius: 8, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800 }}>
                 <RefreshCcw size={16} /> RESET MAP VIEW
             </button>
          </div>
        </div>

        {/* Manifest & Comms */}
        <div style={{ background: '#0f172a', display: 'flex', flexDirection: 'column' }}>
           <div style={{ padding: 20, borderBottom: '1px solid #1e293b' }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: '#64748b', marginBottom: 15, letterSpacing: 1 }}>SECTOR MONITORING</div>
              <div style={{ width: '100%', height: 200, background: '#000', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <Video size={32} color="rgba(255,255,255,0.05)" />
              </div>
           </div>
           <div style={{ padding: 20, borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#64748b' }}>LIVE MANIFEST</span>
              <Users size={14} color="#64748b" />
           </div>
           <div style={{ flex: 1, overflowY: 'auto', padding: 15, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {guestDB.map((guest, i) => (
                <div key={i} style={{ padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10 }}>
                   <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{guest.name}</div>
                   <div style={{ fontSize: 11, color: '#64748b' }}>{guest.room} • {guest.priority}</div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};
