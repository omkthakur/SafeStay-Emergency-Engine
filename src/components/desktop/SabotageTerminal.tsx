import React, { useState } from 'react';
import { Flame, Zap, Wind, ShieldAlert, Crosshair, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
// Removed CSS import for inline-only robust styling
import { useEmergencyEngine } from '../../context/EmergencyContext';

export const SabotageTerminal: React.FC = () => {
    const navigate = useNavigate();
    const { mapConfig, triggerHazardAtNode, resetSystem, hazardZones, activeGuests } = useEmergencyEngine();
    
    const [pan, setPan] = useState({ x: 200, y: 200 });
    const [zoom, setZoom] = useState(0.8);
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

    return (
        <div style={{ backgroundColor: '#050000', color: '#fff', height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'monospace' }}>
            {/* Forbidden Header */}
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderBottom: '2px solid #ef4444', height: '70px', display: 'flex', alignItems: 'center', padding: '0 25px', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                    <button onClick={() => navigate('/admin')} style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', padding: '5px 10px', borderRadius: 4 }}>
                        <ArrowLeft size={20} />
                    </button>
                    <Flame size={24} color="#ef4444" style={{ animation: 'pulse 1s infinite' }} />
                    <h1 style={{ color: '#ef4444', margin: 0, fontSize: 20, letterSpacing: 4, fontWeight: 900 }}>SABOTAGE TERMINAL</h1>
                </div>
                
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 8, color: '#ef4444' }}>LIVE_GUESTS</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>0{activeGuests.length}</div>
                    </div>
                    <button onClick={resetSystem} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, fontWeight: 900, cursor: 'pointer', fontSize: 10 }}>
                        CLEAR_ALL_HAZARDS
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', flex: 1 }}>
                {/* Left Controls */}
                <div style={{ background: '#0a0000', padding: 20, borderRight: '1px solid #300', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ padding: 20, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid #ef4444', borderRadius: 12 }}>
                        <h3 style={{ color: '#ef4444', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ShieldAlert size={18} /> THREAT INJECTION
                        </h3>
                        <p style={{ fontSize: 11, opacity: 0.6, color: '#fff', marginBottom: 20 }}>
                            Select a breach type and click any node on the architectural floorplan to compromise the route.
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <button style={{ background: '#300', border: '1px solid #ef4444', padding: 15, borderRadius: 8, color: '#ef4444', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                <Flame size={24} />
                                <span style={{ fontSize: 9, fontWeight: 900 }}>FIRE</span>
                            </button>
                            <button style={{ background: '#000', border: '1px solid #333', padding: 15, borderRadius: 8, color: '#666', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                <Zap size={24} />
                                <span style={{ fontSize: 9, fontWeight: 900 }}>ELECTRICAL</span>
                            </button>
                            <button style={{ background: '#000', border: '1px solid #333', padding: 15, borderRadius: 8, color: '#666', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                <Wind size={24} />
                                <span style={{ fontSize: 9, fontWeight: 900 }}>OXYGEN</span>
                            </button>
                            <button style={{ background: '#000', border: '1px solid #333', padding: 15, borderRadius: 8, color: '#666', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                <Crosshair size={24} />
                                <span style={{ fontSize: 9, fontWeight: 900 }}>LOCKDOWN</span>
                            </button>
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto', padding: 20, background: '#000', borderRadius: 12, border: '1px solid #222' }}>
                        <div style={{ color: '#ef4444', fontSize: 10, fontWeight: 900, marginBottom: 10 }}>SABOTAGE LOGS</div>
                        <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 10, color: '#666', fontFamily: 'monospace' }}>
                            {hazardZones.map((hz, i) => (
                                <div key={i} style={{ marginBottom: 5 }}>{`> HAZARD_INJECTED_AT_${hz.cx}_${hz.cy}`}</div>
                            ))}
                            <div>{`> SYSTEM_READY_FOR_SABOTAGE...`}</div>
                        </div>
                    </div>
                </div>

                {/* Tactical Map Container */}
                <div 
                    onMouseDown={handleMouseDown} 
                    onMouseMove={handleMouseMove} 
                    onMouseUp={handleMouseUp} 
                    onMouseLeave={handleMouseUp}
                    style={{ position: 'relative', overflow: 'hidden', cursor: isDragging ? 'grabbing' : 'crosshair', background: '#080000', height: '100%' }}
                >
                    <svg 
                        width="100%" 
                        height="100%" 
                        viewBox="0 0 2000 2000"
                        style={{ background: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' }}
                    >
                        <g style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: isDragging ? 'none' : 'transform 0.1s ease-out' }}>
                            <defs>
                                <pattern id="sabotage-grid" width="100" height="100" patternUnits="userSpaceOnUse">
                                    <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(239, 68, 68, 0.05)" strokeWidth="1"/>
                                </pattern>
                            </defs>
                            <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#sabotage-grid)" />

                            {/* Architectural Zones with Names */}
                            {mapConfig.zones?.map((zone) => (
                                <g key={zone.id}>
                                    <rect 
                                        x={zone.x} y={zone.y} width={zone.w} height={zone.h} 
                                        fill="rgba(239, 68, 68, 0.02)" 
                                        stroke="rgba(239, 68, 68, 0.1)" strokeWidth="1"
                                    />
                                    <text 
                                        x={zone.x + zone.w/2} y={zone.y + zone.h/2} 
                                        textAnchor="middle" fill="rgba(239, 68, 68, 0.2)" 
                                        style={{ fontSize: '24px', fontWeight: 900, pointerEvents: 'none', letterSpacing: '2px' }}
                                    >
                                        {zone.label?.toUpperCase()}
                                    </text>
                                </g>
                            ))}

                            {/* Routing Infrastructure */}
                            {mapConfig.links.map((link, i) => {
                                const s = mapConfig.nodes.find(n => n.id === link.source);
                                const t = mapConfig.nodes.find(n => n.id === link.target);
                                if (!s || !t) return null;
                                return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="rgba(239, 68, 68, 0.1)" strokeWidth="4" strokeDasharray="10 5" />;
                            })}

                            {/* Sabotage-Ready Nodes - Minimalist View */}
                            {mapConfig.nodes.map((node) => (
                                <g key={node.id} onClick={(e) => { e.stopPropagation(); triggerHazardAtNode(node.id); }} style={{ cursor: 'pointer' }}>
                                    {/* Transparent Hit Area for easier clicking */}
                                    <circle cx={node.x} cy={node.y} r="30" fill="transparent" />
                                    
                                    {/* Clear, neutral markers for un-sabotaged nodes */}
                                    {!node.isHazard ? (
                                        <circle cx={node.x} cy={node.y} r="15" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                                    ) : (
                                        <g>
                                            <circle cx={node.x} cy={node.y} r="30" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="2">
                                                <animate attributeName="r" values="25;35;25" dur="2s" repeatCount="indefinite" />
                                            </circle>
                                            <foreignObject x={node.x - 12} y={node.y - 12} width="24" height="24">
                                                <div style={{ color: '#ef4444' }}><Flame size={24} /></div>
                                            </foreignObject>
                                        </g>
                                    )}
                                    <text x={node.x} y={node.y + 45} textAnchor="middle" fill={node.isHazard ? '#ef4444' : '#444'} fontSize="10" fontWeight="bold">
                                        {node.label || node.id}
                                    </text>
                                </g>
                            ))}
                            {/* Hazards */}
                            {hazardZones.map((hz, i) => (
                                <g key={`hazard-${i}`}>
                                    <circle cx={hz.cx} cy={hz.cy} r="100" fill="#ef4444" opacity="0.4" />
                                    <foreignObject x={parseInt(hz.cx)-20} y={parseInt(hz.cy)-20} width="40" height="40">
                                        <div style={{ color: '#ef4444' }}><Flame size={40} /></div>
                                    </foreignObject>
                                </g>
                            ))}
                        </g>
                    </svg>

                    <div style={{ position: 'absolute', bottom: 30, right: 30, display: 'flex', gap: 10, zIndex: 1000 }}>
                         <button onClick={() => { setPan({ x: 200, y: 200 }); setZoom(0.8); }} style={{ height: 50, padding: '0 20px', background: '#300', border: '1px solid #ef4444', borderRadius: 12, color: '#ef4444', cursor: 'pointer', fontWeight: 900, fontSize: 10 }}>CENTER_MAP</button>
                         <button onClick={() => setZoom(prev => Math.min(prev + 0.2, 4))} style={{ width: 50, height: 50, background: '#100', border: '1px solid #ef4444', borderRadius: 12, color: '#ef4444', cursor: 'pointer', fontWeight: 900, fontSize: 18 }}>+</button>
                         <button onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.4))} style={{ width: 50, height: 50, background: '#100', border: '1px solid #ef4444', borderRadius: 12, color: '#ef4444', cursor: 'pointer', fontWeight: 900, fontSize: 18 }}>-</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
