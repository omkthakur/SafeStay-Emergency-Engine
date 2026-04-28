import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { EntryScreen } from './components/mobile/EntryScreen';
import { EvacuationMap } from './components/mobile/EvacuationMap';
import { StaffDashboard } from './components/desktop/StaffDashboard';
import { AdminPanel } from './components/desktop/AdminPanel';
import { SabotageTerminal } from './components/desktop/SabotageTerminal';
import { SosPage } from './components/mobile/SosPage';
import { LogCenter } from './components/desktop/LogCenter';
import { EmergencyProvider } from './context/EmergencyContext';



const App = () => {
  return (
    <BrowserRouter>
      <EmergencyProvider>
        <Routes>
          <Route path="/" element={<EntryScreen />} />
          <Route path="/sos" element={<SosPage />} />
          <Route path="/map" element={<EvacuationMap />} />
          {/* Internal Facing Routes */}
          <Route path="/staff" element={<StaffDashboard />} />
          <Route path="/logs" element={<LogCenter />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/sabotage" element={<SabotageTerminal />} />
        </Routes>
      </EmergencyProvider>
    </BrowserRouter>
  );
};

export default App;
