import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardList, ArrowLeft, Search, Trash2, 
  Download, Activity, Clock, Flame, ShieldAlert
} from 'lucide-react';
import { useEmergencyEngine } from '../../context/EmergencyContext';

export const LogCenter: React.FC = () => {
  const navigate = useNavigate();
  const { sosLogs, mapConfig, wipeLogs } = useEmergencyEngine();
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ALL');
  const [search, setSearch] = useState('');

  const handleWipe = () => {
    if (window.confirm("PERMANENTLY WIPE ALL TACTICAL LOGS? This action cannot be undone and will erase the entire audit trail.")) {
      wipeLogs();
    }
  };

  const filteredLogs = sosLogs
    .filter(log => {
      if (filter === 'ACTIVE') return log.status === 'ACTIVE';
      if (filter === 'RESOLVED') return log.status === 'RESOLVED';
      return true;
    })
    .filter(log => {
      const location = mapConfig.nodes.find(n => n.id === log.nodeId)?.label || log.nodeId;
      return log.event.toLowerCase().includes(search.toLowerCase()) || 
             location.toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const getEventIcon = (event: string) => {
    if (event.includes('MEDICAL')) return <Activity size={18} color="#38bdf8" />;
    if (event.includes('FIRE') || event.includes('THREAT')) return <Flame size={18} color="#ef4444" />;
    return <ShieldAlert size={18} color="#94a3b8" />;
  };

  return (
    <div style={{ 
      width: '100vw', height: '100vh', backgroundColor: '#020617', color: '#f1f5f9',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      
      {/* Header */}
      <div style={{ 
        height: 80, background: '#0f172a', borderBottom: '1px solid #1e293b',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button 
            onClick={() => navigate('/staff')}
            style={{ 
              background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 10, 
              color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' 
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>TACTICAL LOG CENTER</h1>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800, letterSpacing: 1 }}>SYSTEM ARCHIVE & AUDIT</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 15 }}>
          <button 
            onClick={handleWipe}
            style={{ 
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', 
              borderRadius: 8, padding: '10px 20px', color: '#ef4444', fontWeight: 900, fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            <Trash2 size={16} /> WIPE ARCHIVE
          </button>
          <button 
             style={{ 
              background: '#38bdf8', border: 'none', 
              borderRadius: 8, padding: '10px 20px', color: '#000', fontWeight: 900, fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            <Download size={16} /> EXPORT PDF
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ 
        background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '15px 40px',
        display: 'flex', gap: 20, alignItems: 'center'
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} color="#475569" style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Search by event, location, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              width: '100%', background: '#020617', border: '1px solid #1e293b', borderRadius: 10,
              padding: '12px 12px 12px 45px', color: '#fff', outline: 'none', fontSize: 14
            }}
          />
        </div>
        <div style={{ display: 'flex', background: '#020617', borderRadius: 10, padding: 4, border: '1px solid #1e293b' }}>
          {(['ALL', 'ACTIVE', 'RESOLVED'] as const).map(t => (
            <button 
              key={t}
              onClick={() => setFilter(t)}
              style={{ 
                padding: '8px 20px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 800,
                background: filter === t ? '#1e293b' : 'transparent',
                color: filter === t ? '#38bdf8' : '#64748b', cursor: 'pointer'
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Log Feed */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 15 }}>
          {filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '100px 0', opacity: 0.3 }}>
              <ClipboardList size={64} style={{ marginBottom: 20 }} />
              <h3>No logs matching your criteria</h3>
            </div>
          ) : (
            filteredLogs.map((log, i) => (
              <div key={log.id || i} style={{ 
                background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 25,
                display: 'grid', gridTemplateColumns: '80px 1fr 200px', alignItems: 'center', gap: 30,
                transition: 'transform 0.2s, border-color 0.2s', cursor: 'pointer'
              }} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#334155' } onMouseLeave={(e) => e.currentTarget.style.borderColor = '#1e293b' }>
                
                <div style={{ 
                  width: 60, height: 60, borderRadius: 12, background: 'rgba(255,255,255,0.02)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {getEventIcon(log.event)}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{log.event}</span>
                    <span style={{ 
                      fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 4,
                      background: log.status === 'ACTIVE' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      color: log.status === 'ACTIVE' ? '#ef4444' : '#10b981', border: `1px solid ${log.status === 'ACTIVE' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
                    }}>
                      {log.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 15 }}>
                     <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14}/> {new Date(log.timestamp).toLocaleString()}</span>
                     <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Search size={14}/> {mapConfig.nodes.find(n => n.id === log.nodeId)?.label || log.nodeId}</span>
                  </div>
                  {log.description && (
                    <div style={{ marginTop: 15, fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
                      "{log.description}"
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                   <div style={{ fontSize: 10, color: '#475569', fontWeight: 900, marginBottom: 4 }}>INCIDENT ID</div>
                   <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{log.id?.slice(-12) || 'AUTO_GEN'}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
