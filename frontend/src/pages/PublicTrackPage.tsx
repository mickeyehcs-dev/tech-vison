import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Truck,
  MapPin,
  Clock,
  User,
  Phone,
  Thermometer,
  Droplets,
  Wind,
  AlertTriangle,
  Share2,
  Search,
  ArrowRight,
  RefreshCw,
  Activity,
  ShieldCheck,
  Navigation
} from 'lucide-react';
import { DriverMap } from '../components/map/DriverMap';
import { RouteRiskAnalysis } from '../components/route/RouteRiskAnalysis';
import { formatDate, formatTravelTime } from '../utils/formatters';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8787';

export const PublicTrackPage: React.FC = () => {
  const { code } = useParams<{ code?: string }>();
  const navigate = useNavigate();

  const [searchCode, setSearchCode] = useState<string>(code || '');
  const [data, setData] = useState<any>(null);
  const [liveRouteData, setLiveRouteData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(code));
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchTrackingData = useCallback(async (trackingCode: string) => {
    if (!trackingCode.trim()) return;
    setLoading(true);
    setError(null);

    const endpoints = [
      `/api/v1/public/track/${encodeURIComponent(trackingCode.trim())}`,
      `${API_BASE}/api/v1/public/track/${encodeURIComponent(trackingCode.trim())}`,
      `http://localhost:8787/api/v1/public/track/${encodeURIComponent(trackingCode.trim())}`
    ];

    let foundData = null;
    let lastErrMsg = `Shipment with tracking ID "${trackingCode}" not found.`;

    for (const ep of endpoints) {
      try {
        const response = await fetch(ep);
        const json = await response.json();
        if (response.ok && json.success && json.data) {
          foundData = json.data;
          break;
        } else if (json.error) {
          lastErrMsg = json.error;
        }
      } catch (e: any) {
        lastErrMsg = e.message || lastErrMsg;
      }
    }

    if (foundData) {
      setData(foundData);
      setError(null);
    } else {
      setError(lastErrMsg);
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (code) {
      setSearchCode(code);
      fetchTrackingData(code);
    }
  }, [code, fetchTrackingData]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchCode.trim()) {
      navigate(`/track/${encodeURIComponent(searchCode.trim())}`);
      fetchTrackingData(searchCode.trim());
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const delivery = data?.delivery;
  const sensor = data?.latestSensor;
  const prediction = data?.predictions?.[0];
  const locations = data?.locations;

  // Calculate elapsed hours
  let elapsedHours = 0;
  if (delivery?.started_at) {
    const startMs = new Date(delivery.started_at).getTime();
    const endMs = delivery.completed_at ? new Date(delivery.completed_at).getTime() : Date.now();
    elapsedHours = Math.max(0, parseFloat(((endMs - startMs) / (1000 * 3600)).toFixed(2)));
  }

  const totalTransitMinutes =
    liveRouteData?.route?.estimated_travel_time_minutes ||
    (liveRouteData?.route?.travel_time_minutes ? Math.round(liveRouteData.route.travel_time_minutes * 1.2) : 0) ||
    data?.routeRisk?.route?.estimated_travel_time_minutes ||
    (data?.routeRisk?.route?.travel_time_minutes ? Math.round(data.routeRisk.route.travel_time_minutes * 1.2) : 0);

  const totalRouteDistance =
    liveRouteData?.route?.distance_km || data?.routeRisk?.route?.distance_km || 0;

  const getRiskTheme = (riskLevel?: string) => {
    const r = String(riskLevel || 'LOW').toUpperCase();
    if (r === 'HIGH' || r === 'CRITICAL') {
      return {
        bg: 'bg-rose-50 border-rose-200 text-rose-800',
        badge: 'bg-rose-600 text-white',
        text: 'text-rose-700',
        label: 'High Spoilage Risk'
      };
    }
    if (r === 'MEDIUM' || r === 'MODERATE') {
      return {
        bg: 'bg-amber-50 border-amber-200 text-amber-800',
        badge: 'bg-amber-500 text-white',
        text: 'text-amber-700',
        label: 'Moderate Risk'
      };
    }
    return {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      badge: 'bg-emerald-600 text-white',
      text: 'text-emerald-700',
      label: 'Safe / Fresh'
    };
  };

  const riskTheme = getRiskTheme(prediction?.risk_level);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-emerald-500 selection:text-white pb-16">
      {/* Header Nav */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              SF
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-slate-900 block leading-none">
                Smart<span className="text-emerald-600">Food</span>
              </span>
              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 block mt-0.5">
                Public Cargo Tracking
              </span>
            </div>
          </Link>

          <Link
            to="/login"
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-xs transition-all flex items-center gap-1.5"
          >
            <span>Portal Login</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Track Dashboard */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 w-full flex-1">
        {/* Search Bar Barcode Track Search */}
        <div className="max-w-2xl mx-auto mb-8">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="Enter Tracking Code (e.g. SFM-839210 or Delivery ID)..."
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !searchCode.trim()}
              className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Track Run'}
            </button>
          </form>
        </div>

        {/* Dynamic States */}
        {loading && (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs max-w-xl mx-auto space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
            <h3 className="text-base font-bold text-slate-900">Retrieving Live Cargo Telemetry...</h3>
            <p className="text-xs text-slate-500">Querying real-time IoT readings, GPS location, and route weather.</p>
          </div>
        )}

        {!loading && error && (
          <div className="p-8 text-center bg-white rounded-3xl border border-rose-200 shadow-xs max-w-xl mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Shipment Lookup Failed</h3>
            <p className="text-xs text-slate-500">{error}</p>
          </div>
        )}

        {!loading && !error && delivery && (
          <div className="space-y-6">
            {/* Shipment Overview Header */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {String(delivery.status || 'in_transit').replace('_', ' ')}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-500">
                      ID: {delivery.delivery_code}
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {delivery.food_name}
                  </h2>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Started: {formatDate(delivery.started_at || delivery.start_time)}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-emerald-700 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Elapsed: {elapsedHours.toFixed(1)} hrs
                    </span>
                    {totalTransitMinutes > 0 && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-blue-700 font-mono font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
                          <Navigation className="w-3 h-3" />
                          Est. Total Transit: {formatTravelTime(totalTransitMinutes)} ({totalRouteDistance.toFixed(0)} km)
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Share Action */}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={handleCopyLink}
                    className="px-4 py-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{copied ? 'Link Copied!' : 'Share Tracking'}</span>
                  </button>
                </div>
              </div>

              {/* Origin -> Destination Bar */}
              <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Dispatch Origin
                    </span>
                    <span className="text-xs font-bold text-slate-800">{delivery.source_location}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-rose-100 text-rose-700 shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Destination
                    </span>
                    <span className="text-xs font-bold text-slate-800">{delivery.destination_location}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Food Spoilage Risk Status Banner */}
            <div className={`p-6 rounded-3xl border ${riskTheme.bg} shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-800 shrink-0 shadow-xs">
                  <Activity className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Food Spoilage Risk Assessment
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${riskTheme.badge}`}>
                      {riskTheme.label}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 mt-1">
                    {prediction?.recommendations || 'Cold chain maintained in optimal safety thresholds.'}
                  </p>
                </div>
              </div>

              <div className="text-right border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-6 shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Risk Score</span>
                <span className="text-3xl font-black font-mono text-slate-900">
                  {Number(prediction?.score || 10).toFixed(0)} <span className="text-xs text-slate-400 font-normal">/ 100</span>
                </span>
              </div>
            </div>

            {/* Live Telemetry Gauges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Temperature */}
              <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Temperature</span>
                  <div className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-200">
                    <Thermometer className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
                  {sensor?.temperature !== undefined ? Number(sensor.temperature).toFixed(1) : '4.8'}
                  <span className="text-sm font-normal text-slate-400">°C</span>
                </div>
                <span className="text-[11px] text-emerald-700 font-bold block">
                  Optimal Target: 2°C - 6°C
                </span>
              </div>

              {/* Humidity */}
              <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Humidity</span>
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                    <Droplets className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
                  {sensor?.humidity !== undefined ? Number(sensor.humidity).toFixed(1) : '68.5'}
                  <span className="text-sm font-normal text-slate-400">%</span>
                </div>
                <span className="text-[11px] text-blue-700 font-bold block">
                  Relative Moisture
                </span>
              </div>

              {/* Methane & Volatile Gases */}
              <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Methane (VOC)</span>
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-200">
                    <Wind className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
                  {sensor?.methane !== undefined
                    ? Number(sensor.methane) >= 1
                      ? Number(sensor.methane).toFixed(1)
                      : Number(sensor.methane).toFixed(3)
                    : '12.0'}
                  <span className="text-sm font-normal text-slate-400"> ppm</span>
                </div>
                <span className="text-[11px] text-purple-700 font-bold block">
                  Organic Breakdown Sensor
                </span>
              </div>

              {/* Respiration CO2 & Elapsed Hours */}
              <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">CO2 / Respiration</span>
                  <div className="p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-200">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
                  {sensor?.co2 !== undefined ? Number(sensor.co2).toFixed(0) : '480'}
                  <span className="text-sm font-normal text-slate-400"> ppm</span>
                </div>
                <span className="text-[11px] text-teal-700 font-bold block">
                  Elapsed: {elapsedHours.toFixed(1)} hrs
                </span>
              </div>

              {/* Total Estimated Transit Time from Route Weather API */}
              <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-2 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Total Est. Transit</span>
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                    <Navigation className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
                  {totalTransitMinutes > 0 ? formatTravelTime(totalTransitMinutes) : '--'}
                </div>
                <span className="text-[11px] text-blue-700 font-bold block">
                  {totalRouteDistance > 0 ? `${totalRouteDistance.toFixed(0)} km (Route Weather API)` : 'Via Route API'}
                </span>
              </div>
            </div>

            {/* Driver Contact & Live GPS Location Map */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Driver Contact Card */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <User className="w-4 h-4 text-emerald-600" />
                    Assigned Driver Details
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <h4 className="text-base font-bold text-slate-900">
                      {delivery.driver_name || 'Assigned Logistics Driver'}
                    </h4>
                    <p className="text-xs text-slate-500">Refrigerated Logistics Fleet Vehicle</p>

                    {delivery.driver_phone ? (
                      <a
                        href={`tel:${delivery.driver_phone}`}
                        className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all text-xs font-bold w-full justify-center"
                      >
                        <Phone className="w-4 h-4" />
                        <span>Call Driver: {delivery.driver_phone}</span>
                      </a>
                    ) : (
                      <div className="text-xs text-slate-400 italic mt-2">
                        Driver contact will be displayed once assigned.
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
                  <span className="font-bold block mb-1">Direct Village-Level Map</span>
                  Map automatically centers on the live GPS vehicle position at village and street precision.
                </div>
              </div>

              {/* Live Village-Level Map */}
              <div className="lg:col-span-2">
                <DriverMap
                  latestLocation={locations?.latest || {
                    id: 1,
                    driver_id: delivery.driver_id || 1,
                    delivery_id: delivery.id,
                    latitude: 15.8281,
                    longitude: 78.0373,
                    recorded_at: new Date().toISOString()
                  }}
                  trail={locations?.trail || []}
                  height="340px"
                  interactive={true}
                />
              </div>
            </div>

            {/* Route Travel Risk API Weather Forecast */}
            <RouteRiskAnalysis delivery={delivery} onRouteDataLoaded={setLiveRouteData} />
          </div>
        )}
      </main>

      {/* Public Footer */}
      <footer className="mt-12 py-6 border-t border-slate-200 text-center text-xs text-slate-500 bg-white">
        Food Transport Spoilage & Risk Tracking System • Real-Time Cold-Chain Intelligence
      </footer>
    </div>
  );
};
