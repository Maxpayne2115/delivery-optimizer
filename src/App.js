import React, { useState, useEffect, useRef } from 'react';
import './App.css';

export default function DeliveryOptimizer() {
  const [parcels, setParcels] = useState([]);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [view, setView] = useState('scanner');
  const [dailyData, setDailyData] = useState({ delivered: 0, earned: 0, distance: 0 });
  const [route, setRoute] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);

  // Sample parcel database
  const parcelDatabase = {
    'SG001': { customer: 'John Tan', address: '123 Woodlands Ave, Singapore 730123', fee: 5.50, lat: 1.4380, lng: 103.8300 },
    'SG002': { customer: 'Mary Lim', address: '456 Bukit Batok Ave 5, Singapore 659675', fee: 6.00, lat: 1.3521, lng: 103.7496 },
    'SG003': { customer: 'Ahmed Hassan', address: '789 Jurong East St 13, Singapore 609608', fee: 5.50, lat: 1.3338, lng: 103.7430 },
    'SG004': { customer: 'Priya Kumar', address: '321 Clementi Rd, Singapore 129742', fee: 7.00, lat: 1.3150, lng: 103.7618 },
    'SG005': { customer: 'David Chua', address: '654 Orchard Rd, Singapore 238876', fee: 8.00, lat: 1.3053, lng: 103.8329 },
    'TEST01': { customer: 'Test Customer', address: '1 Marina Bay, Singapore 018989', fee: 5.50, lat: 1.2821, lng: 103.8602 },
    'TEST02': { customer: 'Test 2', address: '50 Raffles Pl, Singapore 048623', fee: 6.00, lat: 1.2832, lng: 103.8507 },
  };

  // ERP zones
  const erpZones = [
    { name: 'CBD', lat: 1.2832, lng: 103.8507, radius: 2.5, active: true, peakPrice: 6.50 },
    { name: 'Orchard', lat: 1.3053, lng: 103.8329, radius: 1.8, active: true, peakPrice: 5.00 },
    { name: 'Marina Bay', lat: 1.2821, lng: 103.8602, radius: 1.5, active: true, peakPrice: 6.50 },
    { name: 'Sentosa Approach', lat: 1.2465, lng: 103.8190, radius: 1.2, active: false, peakPrice: 0 },
  ];

  // Get location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      pos => setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCurrentLocation({ lat: 1.3521, lng: 103.8198 })
    );
  }, []);

  // Calculate distance
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Route optimization
  const optimizeRoute = (parcelList, userLat, userLng) => {
    if (parcelList.length === 0) return [];
    let optimized = [];
    let remaining = [...parcelList];
    let currentLat = userLat;
    let currentLng = userLng;

    while (remaining.length > 0) {
      let closest = null;
      let closestIdx = 0;
      let minDistance = Infinity;

      remaining.forEach((p, idx) => {
        const dist = calculateDistance(currentLat, currentLng, p.lat, p.lng);
        let erpPenalty = 0;
        erpZones.forEach(zone => {
          const zoneDistance = calculateDistance(p.lat, p.lng, zone.lat, zone.lng);
          if (zoneDistance < zone.radius && zone.active) {
            erpPenalty += 2;
          }
        });

        const totalCost = dist + erpPenalty;
        if (totalCost < minDistance) {
          minDistance = totalCost;
          closest = p;
          closestIdx = idx;
        }
      });

      if (closest) {
        optimized.push({ ...closest, sequence: optimized.length + 1 });
        currentLat = closest.lat;
        currentLng = closest.lng;
        remaining.splice(closestIdx, 1);
      }
    }
    return optimized;
  };

  // Handle scan
  const handleScan = () => {
    const barcode = scannedBarcode.trim().toUpperCase();
    if (parcelDatabase[barcode]) {
      const parcel = { ...parcelDatabase[barcode], barcode, scannedAt: new Date().toLocaleTimeString() };
      setParcels(prev => [...prev, parcel]);
      setScannedBarcode('');
      if (currentLocation) {
        const optimized = optimizeRoute([...parcels, parcel], currentLocation.lat, currentLocation.lng);
        setRoute(optimized);
      }
    } else {
      alert('Barcode not found. Try: SG001, SG002, SG003, SG004, SG005, TEST01, TEST02');
    }
  };

  // Mark delivered
  const markDelivered = (barcode) => {
    const parcel = parcels.find(p => p.barcode === barcode);
    if (parcel) {
      setParcels(prev => prev.filter(p => p.barcode !== barcode));
      setDailyData(prev => ({
        delivered: prev.delivered + 1,
        earned: Math.round((prev.earned + parcel.fee) * 100) / 100,
        distance: Math.round((prev.distance + 0.5) * 100) / 100
      }));
    }
  };

  // Check ERP
  const isInERPZone = (lat, lng) => {
    return erpZones.find(zone => {
      const dist = calculateDistance(lat, lng, zone.lat, zone.lng);
      return dist < zone.radius && zone.active;
    });
  };

  const getMonthData = () => {
    return [
      { date: '2024-06-01', delivered: 28, earned: 154.50 },
      { date: '2024-06-02', delivered: 32, earned: 176.00 },
      { date: '2024-06-03', delivered: 25, earned: 137.50 },
      { date: '2024-06-04', delivered: 35, earned: 192.50 },
      { date: '2024-06-05', delivered: 30, earned: 165.00 },
    ];
  };

  return (
    <div style={{ fontFamily: 'system-ui', background: '#f5f5f5', minHeight: '100vh', padding: '12px' }}>
      {/* Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'white', padding: '8px', borderRadius: '8px' }}>
        {[
          { id: 'scanner', label: 'Scan', icon: '📱' },
          { id: 'map', label: 'Map', icon: '🗺️' },
          { id: 'dashboard', label: 'Today', icon: '📊' },
          { id: 'monthly', label: 'Month', icon: '📈' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setView(tab.id)}
            style={{
              flex: 1, padding: '10px', border: 'none', background: view === tab.id ? '#2196F3' : '#e0e0e0',
              color: view === tab.id ? 'white' : '#333', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500'
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* SCANNER VIEW */}
      {view === 'scanner' && (
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px' }}>
          <h2 style={{ marginTop: 0, fontSize: '18px', color: '#333' }}>📱 Barcode Scanner</h2>
          
          <input type="text" placeholder="Enter barcode or click camera" value={scannedBarcode}
            onChange={(e) => setScannedBarcode(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleScan()}
            style={{ width: '100%', padding: '12px', marginBottom: '8px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} />
          
          <button onClick={handleScan} style={{ width: '100%', padding: '12px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '16px' }}>
            ✓ Scan Parcel
          </button>

          <h3 style={{ fontSize: '14px', color: '#666', marginTop: '16px' }}>Scanned Parcels ({parcels.length})</h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {parcels.length === 0 ? (
              <p style={{ color: '#999', fontSize: '13px' }}>No parcels scanned yet</p>
            ) : (
              parcels.map((p, idx) => {
                const inERP = isInERPZone(p.lat, p.lng);
                return (
                  <div key={idx} style={{ background: inERP ? '#ffebee' : '#f0f0f0', padding: '10px', marginBottom: '8px', borderRadius: '6px', borderLeft: inERP ? '3px solid #d32f2f' : '3px solid #4CAF50' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#333' }}>#{p.sequence || idx + 1} {p.customer}</div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{p.address}</div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>₪{p.fee} {inERP && '⚠️ ERP Zone'}</div>
                    <button onClick={() => markDelivered(p.barcode)} style={{ marginTop: '8px', padding: '6px 12px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                      ✓ Delivered
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MAP VIEW */}
      {view === 'map' && (
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px' }}>
          <h2 style={{ marginTop: 0, fontSize: '18px', color: '#333' }}>🗺️ Singapore Delivery Map</h2>
          
          <div style={{ background: '#e8f5e9', padding: '12px', borderRadius: '6px', marginBottom: '12px', fontSize: '13px', color: '#2e7d32' }}>
            <strong>ERP Zones Active:</strong> CBD, Orchard, Marina Bay • <strong>Dormant:</strong> Sentosa
          </div>

          <div style={{ background: '#f5f5f5', borderRadius: '6px', padding: '16px', minHeight: '400px', textAlign: 'center' }}>
            <div style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#333' }}>Your Location: {currentLocation ? `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : 'Loading...'}</strong>
            </div>

            <div style={{ marginBottom: '16px', fontSize: '13px', color: '#666' }}>
              📍 Parcels to deliver: {parcels.length}
            </div>

            {/* ERP Zones Status */}
            <div style={{ marginTop: '16px', textAlign: 'left' }}>
              <h3 style={{ fontSize: '13px', marginBottom: '8px', color: '#333' }}>ERP Zone Status</h3>
              {erpZones.map((zone, idx) => (
                <div key={idx} style={{ background: zone.active ? '#ffebee' : '#e8f5e9', padding: '10px', marginBottom: '8px', borderRadius: '6px', fontSize: '12px', borderLeft: `3px solid ${zone.active ? '#d32f2f' : '#4CAF50'}` }}>
                  <strong>{zone.name}</strong> {zone.active ? '🔴 ACTIVE' : '🟢 DORMANT'} {zone.active && `• Peak: ₪${zone.peakPrice}`}
                </div>
              ))}
            </div>

            {/* Route Summary */}
            {route.length > 0 && (
              <div style={{ marginTop: '16px', textAlign: 'left', background: '#e3f2fd', padding: '12px', borderRadius: '6px' }}>
                <h3 style={{ fontSize: '13px', marginBottom: '8px', color: '#1976d2' }}>Optimized Route ({route.length})</h3>
                {route.slice(0, 5).map((p, idx) => (
                  <div key={idx} style={{ fontSize: '11px', color: '#333', marginBottom: '4px' }}>
                    {p.sequence}. {p.customer} - {(calculateDistance(currentLocation.lat, currentLocation.lng, p.lat, p.lng)).toFixed(1)} km
                  </div>
                ))}
              </div>
            )}

            <p style={{ marginTop: '24px', color: '#999', fontSize: '12px' }}>Map with Leaflet + OpenStreetMap integration ready</p>
          </div>
        </div>
      )}

      {/* DASHBOARD VIEW */}
      {view === 'dashboard' && (
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px' }}>
          <h2 style={{ marginTop: 0, fontSize: '18px', color: '#333' }}>📊 Today's Dashboard</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#e8f5e9', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#2e7d32', marginBottom: '4px' }}>Delivered</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2e7d32' }}>{dailyData.delivered}</div>
              <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>Parcels</div>
            </div>

            <div style={{ background: '#fff3e0', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#e65100', marginBottom: '4px' }}>Earned Today</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#e65100' }}>₪{dailyData.earned.toFixed(2)}</div>
              <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>SGD</div>
            </div>
          </div>

          <h3 style={{ fontSize: '13px', color: '#333', marginTop: '16px', marginBottom: '8px' }}>Pending Deliveries ({parcels.length})</h3>
          {parcels.length === 0 ? (
            <p style={{ color: '#999', fontSize: '13px' }}>All deliveries completed! 🎉</p>
          ) : (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {route.map((p, idx) => (
                <div key={idx} style={{ background: '#f5f5f5', padding: '12px', marginBottom: '8px', borderRadius: '6px', fontSize: '13px' }}>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>{p.sequence}. {p.customer}</div>
                  <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>{p.address}</div>
                  <div style={{ color: '#999', fontSize: '11px', marginTop: '2px' }}>₪{p.fee}</div>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => { setDailyData({ delivered: 0, earned: 0, distance: 0 }); setParcels([]); setRoute([]); }} style={{ marginTop: '16px', width: '100%', padding: '12px', background: '#757575', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            🔄 Reset Day
          </button>
        </div>
      )}

      {/* MONTHLY VIEW */}
      {view === 'monthly' && (
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px' }}>
          <h2 style={{ marginTop: 0, fontSize: '18px', color: '#333' }}>📈 Monthly Report</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#e8f5e9', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#2e7d32', marginBottom: '4px' }}>Total Deliveries</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2e7d32' }}>150</div>
            </div>
            <div style={{ background: '#fff3e0', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#e65100', marginBottom: '4px' }}>Total Earnings</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e65100' }}>₪825.00</div>
            </div>
          </div>

          <h3 style={{ fontSize: '13px', color: '#333', marginTop: '16px', marginBottom: '8px' }}>Daily Breakdown</h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {getMonthData().map((day, idx) => (
              <div key={idx} style={{ background: '#f5f5f5', padding: '12px', marginBottom: '8px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#333' }}>{day.date}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{day.delivered} parcels</div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '14px', color: '#2e7d32' }}>₪{day.earned.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}