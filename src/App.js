import React, { useState, useEffect, useRef } from 'react';
import './App.css';

export default function DeliveryOptimizer() {
  const [parcels, setParcels] = useState([]);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [view, setView] = useState('scanner');
  const [dailyData, setDailyData] = useState({ delivered: 0, earned: 0, distance: 0 });
  const [route, setRoute] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Pricing structure based on sender category and weight
  const pricingRules = {
    'CATA': [
      { min: 0.1, max: 1, price: 1.2 },
      { min: 1.1, max: 3, price: 1.3 },
      { min: 3.1, max: 5, price: 1.4 },
      { min: 5.1, max: 10, price: 2.5 },
      { min: 10.1, max: 20, price: 5 },
      { min: 20.1, max: 30, price: 7 },
      { min: 30.1, max: 50, price: 14.5 },
      { min: 50.1, max: 100, price: 19.5 },
      { addPerKg: 0.1 }
    ],
    'CATB': [
      { min: 0.1, max: 10, price: 2.5 },
      { addPerKg: 0.15 }
    ],
    'CATC': [
      { min: 0.1, max: 5, price: 2.5 },
      { min: 5.1, max: 100, price: 5 },
      { addPerKg: 0.1 }
    ]
  };

  // Expanded delivery database with weight and category
  const deliveryDatabase = {
    'TR001': { customer: 'John Tan', address: '123 Woodlands Ave, Singapore 730123', weight: 2.5, category: 'CATA', lat: 1.4380, lng: 103.8300 },
    'TR002': { customer: 'Mary Lim', address: '456 Bukit Batok Ave 5, Singapore 659675', weight: 8.5, category: 'CATB', lat: 1.3521, lng: 103.7496 },
    'TR003': { customer: 'Ahmed Hassan', address: '789 Jurong East St 13, Singapore 609608', weight: 3.2, category: 'CATA', lat: 1.3338, lng: 103.7430 },
    'TR004': { customer: 'Priya Kumar', address: '321 Clementi Rd, Singapore 129742', weight: 6.0, category: 'CATC', lat: 1.3150, lng: 103.7618 },
    'TR005': { customer: 'David Chua', address: '654 Orchard Rd, Singapore 238876', weight: 1.2, category: 'CATA', lat: 1.3053, lng: 103.8329 },
    'SG001': { customer: 'Test 1', address: '1 Marina Bay, Singapore 018989', weight: 4.5, category: 'CATC', lat: 1.2821, lng: 103.8602 },
    'SG002': { customer: 'Test 2', address: '50 Raffles Pl, Singapore 048623', weight: 0.8, category: 'CATA', lat: 1.2832, lng: 103.8507 },
  };

  // ERP zones in Singapore
  const erpZones = [
    { name: 'CBD', lat: 1.2832, lng: 103.8507, radius: 2.5, active: true, peakPrice: 6.50 },
    { name: 'Orchard', lat: 1.3053, lng: 103.8329, radius: 1.8, active: true, peakPrice: 5.00 },
    { name: 'Marina Bay', lat: 1.2821, lng: 103.8602, radius: 1.5, active: true, peakPrice: 6.50 },
    { name: 'Sentosa Approach', lat: 1.2465, lng: 103.8190, radius: 1.2, active: false, peakPrice: 0 },
  ];

  // Get user location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      pos => setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCurrentLocation({ lat: 1.3521, lng: 103.8198 })
    );
  }, []);

  // Calculate price based on weight and category
  const calculatePrice = (weight, category) => {
    const rules = pricingRules[category] || pricingRules['CATA'];
    let basePrice = 0;
    let addPerKg = 0;

    for (let i = 0; i < rules.length; i += 1) {
      const rule = rules[i];
      if (rule.addPerKg) {
        addPerKg = rule.addPerKg;
      } else if (weight >= rule.min && weight <= rule.max) {
        basePrice = rule.price;
        break;
      }
    }

    // If weight exceeds base tier, add extra per kg
    if (basePrice === 0) {
      const lastTier = rules.filter(r => !r.addPerKg)[rules.length - 2];
      if (lastTier && weight > lastTier.max) {
        basePrice = lastTier.price;
        const extraWeight = weight - lastTier.max;
        basePrice += extraWeight * addPerKg;
      }
    }

    return Math.round(basePrice * 100) / 100;
  };

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
    
    const optimized = [];
    const remaining = [...parcelList];
    let currentLat = userLat;
    let currentLng = userLng;

    while (remaining.length > 0) {
      let closest = null;
      let closestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < remaining.length; i += 1) {
        const p = remaining[i];
        const dist = calculateDistance(currentLat, currentLng, p.lat, p.lng);
        let erpPenalty = 0;

        for (let j = 0; j < erpZones.length; j += 1) {
          const zone = erpZones[j];
          const zoneDistance = calculateDistance(p.lat, p.lng, zone.lat, zone.lng);
          if (zoneDistance < zone.radius && zone.active) {
            erpPenalty += 2;
          }
        }

        const totalCost = dist + erpPenalty;
        if (totalCost < minDistance) {
          minDistance = totalCost;
          closest = p;
          closestIdx = i;
        }
      }

      if (closest) {
        optimized.push({ ...closest, sequence: optimized.length + 1 });
        currentLat = closest.lat;
        currentLng = closest.lng;
        remaining.splice(closestIdx, 1);
      }
    }

    return optimized;
  };

  // Start camera for barcode scanning
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      alert('Camera access denied. Please use manual entry.');
      setShowScanner(false);
    }
  };

// Capture frame from camera
const captureFrame = async () => {
  if (videoRef.current && canvasRef.current) {
    try {
      const context = canvasRef.current.getContext('2d');
      context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      
      const imageData = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      const { ZXingBrowser } = window;
      
      // This would work if ZXing is loaded globally
      // For now, use manual entry as shown in the app
      alert('Photo captured. Please enter the tracking number manually below.');
    } catch (err) {
      console.log('Barcode detection pending library setup');
    }
  }
};

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
    setIsCameraActive(false);
    setShowScanner(false);
  };

  // Handle tracking number submission
  const handleTrackingSubmit = () => {
    const trackNum = trackingNumber.trim().toUpperCase();
    if (deliveryDatabase[trackNum]) {
      const delivery = deliveryDatabase[trackNum];
      const fee = calculatePrice(delivery.weight, delivery.category);
      const parcel = { 
        ...delivery, 
        trackingNumber: trackNum, 
        fee, 
        status: 'pending',
        scannedAt: new Date().toLocaleTimeString() 
      };
      setParcels(prev => [...prev, parcel]);
      setTrackingNumber('');
      
      if (currentLocation) {
        const optimized = optimizeRoute([...parcels, parcel], currentLocation.lat, currentLocation.lng);
        setRoute(optimized);
      }
      setShowScanner(false);
      stopCamera();
    } else {
      alert('Tracking number not found. Try: TR001, TR002, TR003, TR004, TR005, SG001, SG002');
    }
  };

  // Mark delivery as complete
  const markDelivered = (trackingNumber) => {
    const parcel = parcels.find(p => p.trackingNumber === trackingNumber);
    if (parcel) {
      setParcels(prev => prev.filter(p => p.trackingNumber !== trackingNumber));
      setDailyData(prev => ({
        delivered: prev.delivered + 1,
        earned: Math.round((prev.earned + parcel.fee) * 100) / 100,
        distance: Math.round((prev.distance + 0.5) * 100) / 100
      }));
    }
  };

  // Check if in ERP zone
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
      {/* Navigation Tabs */}
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
          <h2 style={{ marginTop: 0, fontSize: '18px', color: '#333' }}>📱 Delivery Scanner</h2>
          
          {!showScanner ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                <button onClick={() => { setShowScanner(true); startCamera(); }} 
                  style={{ padding: '12px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  📸 Open Camera
                </button>
                <button onClick={() => setShowScanner(true)} 
                  style={{ padding: '12px', background: '#FF9800', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  ✏️ Manual Entry
                </button>
              </div>
            </div>
          ) : (
            <div>
              {isCameraActive && (
                <div style={{ marginBottom: '16px' }}>
                  <video ref={videoRef} style={{ width: '100%', borderRadius: '6px', backgroundColor: '#000', marginBottom: '8px' }} autoPlay />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button onClick={captureFrame} style={{ padding: '10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                      📷 Capture
                    </button>
                    <button onClick={stopCamera} style={{ padding: '10px', background: '#f44336', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                      ✕ Close Camera
                    </button>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '16px' }}>
                <h3 style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>Or Enter Tracking Number</h3>
                <input type="text" placeholder="Enter tracking number (e.g., TR001)" value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleTrackingSubmit()}
                  style={{ width: '100%', padding: '12px', marginBottom: '8px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} />
                
                <button onClick={handleTrackingSubmit} style={{ width: '100%', padding: '12px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  ✓ Add to Delivery List
                </button>

                <button onClick={() => { setShowScanner(false); stopCamera(); }} style={{ width: '100%', padding: '10px', background: '#999', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '8px' }}>
                  ← Back
                </button>
              </div>
            </div>
          )}

          <h3 style={{ fontSize: '14px', color: '#666', marginTop: '16px' }}>Queue ({parcels.length})</h3>
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {parcels.length === 0 ? (
              <p style={{ color: '#999', fontSize: '13px' }}>No deliveries added yet</p>
            ) : (
              parcels.map((p, idx) => {
                const inERP = isInERPZone(p.lat, p.lng);
                return (
                  <div key={idx} style={{ background: inERP ? '#ffebee' : '#f0f0f0', padding: '10px', marginBottom: '8px', borderRadius: '6px', borderLeft: inERP ? '3px solid #d32f2f' : '3px solid #4CAF50' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#333' }}>#{p.sequence || idx + 1} {p.customer}</div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>{p.address}</div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                      <strong>Tracking:</strong> {p.trackingNumber} | <strong>Weight:</strong> {p.weight}kg | <strong>Cat:</strong> {p.category}
                    </div>
                    <div style={{ fontSize: '12px', color: '#2e7d32', fontWeight: 'bold', marginTop: '4px' }}>Fee: ₪{p.fee}</div>
                    {inERP && <div style={{ fontSize: '10px', color: '#d32f2f', marginTop: '4px' }}>⚠️ ERP Zone Active</div>}
                    <button onClick={() => markDelivered(p.trackingNumber)} style={{ marginTop: '8px', padding: '6px 12px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
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
              📍 Deliveries queued: {parcels.length}
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
            {route.length > 0 && currentLocation && (
              <div style={{ marginTop: '16px', textAlign: 'left', background: '#e3f2fd', padding: '12px', borderRadius: '6px' }}>
                <h3 style={{ fontSize: '13px', marginBottom: '8px', color: '#1976d2' }}>Optimized Route ({route.length})</h3>
                {route.slice(0, 5).map((p, idx) => (
                  <div key={idx} style={{ fontSize: '11px', color: '#333', marginBottom: '4px' }}>
                    {p.sequence}. {p.customer} - {(calculateDistance(currentLocation.lat, currentLocation.lng, p.lat, p.lng)).toFixed(1)} km
                  </div>
                ))}
              </div>
            )}

            <p style={{ marginTop: '24px', color: '#999', fontSize: '12px' }}>Map visualization (Leaflet integration ready)</p>
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
                  <div style={{ color: '#999', fontSize: '11px', marginTop: '2px' }}>₪{p.fee} | {p.weight}kg | {p.category}</div>
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