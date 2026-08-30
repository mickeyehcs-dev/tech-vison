import React, { useState, useEffect, useCallback } from 'react';
import { Delivery } from '../../types';
import { routeApi, RouteAnalyzeResponse } from '../../api/routeApi';
import { SectionCard } from '../common/SectionCard';
import {
  Navigation,
  CloudRain,
  Thermometer,
  Droplets,
  Wind,
  Clock,
  AlertTriangle,
  Compass,
  Layers,
  List,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { formatDate, formatTravelTime } from '../../utils/formatters';

export interface RouteRiskAnalysisProps {
  delivery: Delivery;
  onRouteDataLoaded?: (data: RouteAnalyzeResponse) => void;
}

function cleanLocation(loc: string): string {
  let cleaned = (loc || '').trim();
  cleaned = cleaned.replace(/\bmadanaplle\b/gi, 'Madanapalle');
  cleaned = cleaned.replace(/\bmadanapalli\b/gi, 'Madanapalle');
  cleaned = cleaned.replace(/\bananthapur\b/gi, 'Anantapur');
  cleaned = cleaned.replace(/\banantapuram\b/gi, 'Anantapur');
  cleaned = cleaned.replace(/\bhyderbad\b/gi, 'Hyderabad');
  cleaned = cleaned.replace(/\bkadapa\b/gi, 'Kadapa');
  cleaned = cleaned.replace(/\bbengaluru\b/gi, 'Bangalore');
  cleaned = cleaned.replace(/\btirupathi\b/gi, 'Tirupati');
  return cleaned;
}

export const RouteRiskAnalysis: React.FC<RouteRiskAnalysisProps> = ({ delivery, onRouteDataLoaded }) => {
  const [data, setData] = useState<RouteAnalyzeResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');

  const origin = cleanLocation(delivery.source_location || 'Anantapur');
  const dest = cleanLocation(delivery.destination_location || 'Hyderabad');

  const getTripStartSchedule = () => {
    const now = new Date();
    // Default departure time is 30 minutes from now or delivery start time
    let target = new Date(now.getTime() + 30 * 60000);
    const timeToUse = delivery.started_at || delivery.start_time || delivery.created_at;
    if (timeToUse) {
      const parsed = new Date(timeToUse);
      if (!isNaN(parsed.getTime())) {
        // If parsed is in the past, use current time so Open-Meteo provides live forecast
        if (parsed.getTime() < now.getTime() - 3600000) {
          target = new Date(now.getTime() + 15 * 60000);
        } else {
          target = parsed;
        }
      }
    }
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const hours = String(target.getHours()).padStart(2, '0');
    const minutes = String(target.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    return { dateStr, timeStr };
  };

  useEffect(() => {
    // 1. Check if delivery already has stored route_risk_data from database
    if (delivery.route_risk_data) {
      try {
        const stored = typeof delivery.route_risk_data === 'string'
          ? JSON.parse(delivery.route_risk_data)
          : delivery.route_risk_data;
        if (stored && stored.route) {
          setData(stored);
          setLoading(false);
          setIsDemoMode(false);
          setError(null);
          if (onRouteDataLoaded) {
            onRouteDataLoaded(stored);
          }
          return;
        }
      } catch (err) {
        console.warn('[RouteRiskAnalysis] Failed to parse stored route_risk_data, falling back to API:', err);
      }
    }

    // 2. Otherwise fetch once from backend / weather API and cache
    let isCancelled = false;
    const loadRouteData = async () => {
      if (!origin || !dest) {
        setError('Please provide valid current location and destination');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const schedule = getTripStartSchedule();
      const departure_date = schedule.dateStr;
      const departure_time = schedule.timeStr;

      const payload = {
        current_location: origin,
        destination: dest,
        departure_date,
        departure_time
      };

      try {
        let res: RouteAnalyzeResponse;
        if (delivery.id) {
          try {
            res = await routeApi.getDeliveryRouteRisk(delivery.id);
          } catch (_) {
            res = await routeApi.analyzeRoute(payload);
          }
        } else {
          res = await routeApi.analyzeRoute(payload);
        }

        if (!isCancelled) {
          setData(res);
          setIsDemoMode(false);
          setError(null);
          if (onRouteDataLoaded) {
            onRouteDataLoaded(res);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('[RouteRiskAnalysis] Route API request error:', err);
          setError(err.message || 'Unable to connect to Weather / Route API at 127.0.0.1:8000');
          setIsDemoMode(true);
          const sim = generateSimulatedRoute(origin, dest, departure_date, departure_time);
          setData(sim);
          if (onRouteDataLoaded) {
            onRouteDataLoaded(sim);
          }
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadRouteData();

    return () => {
      isCancelled = true;
    };
  }, [delivery.id, delivery.route_risk_data]);

  const handleManualRefresh = useCallback(async () => {
    if (!origin || !dest) return;
    setLoading(true);
    setError(null);
    const schedule = getTripStartSchedule();
    const payload = {
      current_location: origin,
      destination: dest,
      departure_date: schedule.dateStr,
      departure_time: schedule.timeStr
    };
    try {
      const res = await routeApi.analyzeRoute(payload);
      setData(res);
      setIsDemoMode(false);
      setError(null);
      if (onRouteDataLoaded) {
        onRouteDataLoaded(res);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to connect to Weather / Route API');
    } finally {
      setLoading(false);
    }
  }, [origin, dest, onRouteDataLoaded]);

  const getRiskBadge = (level: string) => {
    const l = (level || 'low').toLowerCase();
    if (l === 'high') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1 w-fit">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          High Risk
        </span>
      );
    }
    if (l === 'moderate' || l === 'medium') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 w-fit">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          Moderate Risk
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit">
        <ShieldCheck className="w-3 h-3 text-emerald-600" />
        Safe Route
      </span>
    );
  };

  const maxTemp = data?.locations && data.locations.length > 0 ? Math.max(...data.locations.map((l) => l.temperature_c)) : null;
  const minTemp = data?.locations && data.locations.length > 0 ? Math.min(...data.locations.map((l) => l.temperature_c)) : null;
  const maxRain = data?.locations && data.locations.length > 0 ? Math.max(...data.locations.map((l) => l.rain_probability_percent)) : null;
  const maxWind = data?.locations && data.locations.length > 0 ? Math.max(...data.locations.map((l) => l.wind_speed_kmh)) : null;

  return (
    <SectionCard
      title={
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm sm:text-base">
                Route Travel Risk & Weather Forecast
              </span>
              {isDemoMode && (
                <span className="px-2 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  Simulated
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              Trip departure weather hazard evaluation and driving route analysis
            </p>
          </div>
        </div>
      }
      action={
        <div className="flex items-center gap-2">
          {/* Refresh button */}
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
            title="Refresh Route Weather API"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh API</span>
          </button>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'timeline'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Timeline
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Table
            </button>
          </div>
        </div>
      }
    >
      {/* Error alert banner */}
      {error && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start justify-between gap-2.5 text-xs text-amber-900 mb-4 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-amber-950">Live Weather API Status:</span>
              <p className="text-slate-700 text-[11px]">{error}</p>
            </div>
          </div>
          <button
            onClick={handleManualRefresh}
            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shrink-0 cursor-pointer"
          >
            Retry Call
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs font-bold text-slate-800">Querying live weather stations & OSRM routing...</p>
          <p className="text-[11px] text-slate-500 mt-1">Connecting to 127.0.0.1:8000 / Open-Meteo</p>
        </div>
      )}

      {/* Main Content */}
      {data && (
        <div className="flex flex-col gap-5">
          {/* Clean Streamlined Route Journey Header */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Origin -> Destination Flow */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                  <Navigation className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 truncate">
                    <span className="truncate">{delivery.source_location}</span>
                    <span className="text-slate-400 font-normal">→</span>
                    <span className="truncate">{delivery.destination_location}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Departure: {formatDate(data.departure_time)}
                  </span>
                </div>
              </div>

              {/* Distance, Travel Time & Risk Status */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs">
                <div className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono font-medium">
                  {data.route.distance_km.toFixed(1)} km
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-semibold">
                  {formatTravelTime(data.route.estimated_travel_time_minutes || Math.round(data.route.travel_time_minutes * 1.2))}
                </div>
                <div>
                  {getRiskBadge(data.overall_risk.level)}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Weather Highlights Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-50 text-orange-600 border border-orange-200 shrink-0">
                <Thermometer className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-slate-500 font-medium block">Temperature Range</span>
                <span className="text-sm font-bold font-mono text-slate-900 truncate block">
                  {minTemp !== null ? minTemp.toFixed(1) : '--'}°C - {maxTemp !== null ? maxTemp.toFixed(1) : '--'}°C
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 shrink-0">
                <CloudRain className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-slate-500 font-medium block">Peak Rain Chance</span>
                <span className="text-sm font-bold font-mono text-slate-900 truncate block">
                  {maxRain !== null ? maxRain : 0}% rain risk
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-50 text-teal-600 border border-teal-200 shrink-0">
                <Wind className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-slate-500 font-medium block">Max Wind Speed</span>
                <span className="text-sm font-bold font-mono text-slate-900 truncate block">
                  {maxWind !== null ? maxWind.toFixed(1) : 0} km/h
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-200 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-slate-500 font-medium block">Risk Evaluation</span>
                <span className="text-xs font-bold text-slate-800 truncate block">
                  {data.overall_risk.highest_risk_places?.length
                    ? `${data.overall_risk.highest_risk_places.length} alert spot(s)`
                    : 'Optimal path'}
                </span>
              </div>
            </div>
          </div>

          {/* Highest Risk Places Alert (if any) */}
          {data.overall_risk.highest_risk_places && data.overall_risk.highest_risk_places.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900 shadow-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-amber-950">
                  Elevated Weather Risk Along Route:{' '}
                </span>
                <span>{data.overall_risk.highest_risk_places.join(', ')}</span>
                {data.warning && (
                  <p className="text-[11px] text-amber-800 mt-1 font-mono">{data.warning}</p>
                )}
              </div>
            </div>
          )}

          {/* Waypoints View: Timeline Mode */}
          {viewMode === 'timeline' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Route Waypoint Forecasts
                </h4>
                <span className="text-[10px] text-slate-500 font-mono">
                  Sampled along driving path
                </span>
              </div>

              <div className="relative pl-6 space-y-4 before:absolute before:left-[11px] before:top-3 before:bottom-3 before:w-[2px] before:bg-slate-200">
                {data.locations.map((loc, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === data.locations.length - 1;
                  const isHighRisk = (loc.risk.level || '').toLowerCase() === 'high';
                  const isModRisk = (loc.risk.level || '').toLowerCase() === 'moderate';

                  return (
                    <div key={idx} className="relative group">
                      <div
                        className={`absolute -left-[30px] top-4 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold ${
                          isHighRisk
                            ? 'bg-rose-100 border-rose-500 text-rose-800 shadow-xs'
                            : isModRisk
                            ? 'bg-amber-100 border-amber-500 text-amber-800'
                            : isFirst
                            ? 'bg-emerald-100 border-emerald-500 text-emerald-800'
                            : isLast
                            ? 'bg-blue-100 border-blue-500 text-blue-800'
                            : 'bg-white border-slate-300 text-slate-600'
                        }`}
                      >
                        {isFirst ? 'A' : isLast ? 'B' : idx}
                      </div>

                      {/* Waypoint Card */}
                      <div className="p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                {loc.place}
                              </span>
                              <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                +{loc.distance_km.toFixed(1)} km
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              Estimated Arrival: {formatDate(loc.arrival_time)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {getRiskBadge(loc.risk.level)}
                          </div>
                        </div>

                        {/* Weather Metrics Chips */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                          <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                            <span className="text-[11px] text-slate-600 flex items-center gap-1.5">
                              <Thermometer className="w-3.5 h-3.5 text-orange-500" />
                              Temp
                            </span>
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {loc.temperature_c.toFixed(1)}°C
                            </span>
                          </div>

                          <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                            <span className="text-[11px] text-slate-600 flex items-center gap-1.5">
                              <Droplets className="w-3.5 h-3.5 text-blue-500" />
                              Humidity
                            </span>
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {loc.humidity_percent}%
                            </span>
                          </div>

                          <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                            <span className="text-[11px] text-slate-600 flex items-center gap-1.5">
                              <CloudRain className="w-3.5 h-3.5 text-sky-500" />
                              Rain
                            </span>
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {loc.rain_probability_percent}%
                            </span>
                          </div>

                          <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                            <span className="text-[11px] text-slate-600 flex items-center gap-1.5">
                              <Wind className="w-3.5 h-3.5 text-teal-500" />
                              Wind
                            </span>
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {loc.wind_speed_kmh.toFixed(1)} <span className="text-[9px] font-normal text-slate-500">km/h</span>
                            </span>
                          </div>
                        </div>

                        {loc.risk.factors && loc.risk.factors.length > 0 && loc.risk.factors[0] !== 'no elevated weather threshold met' && (
                          <div className="flex items-center gap-2 text-[11px] text-amber-800 pt-1 font-medium">
                            <span className="text-slate-500 font-normal">Triggered Factors:</span>
                            <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                              {loc.risk.factors.join(' • ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Waypoints View: Table Mode */}
          {viewMode === 'table' && (
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Distance</th>
                      <th className="px-4 py-3">ETA</th>
                      <th className="px-4 py-3">Temp</th>
                      <th className="px-4 py-3">Humidity</th>
                      <th className="px-4 py-3">Rain</th>
                      <th className="px-4 py-3">Wind</th>
                      <th className="px-4 py-3">Risk Assessment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {data.locations.map((loc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-900 max-w-[200px] truncate" title={loc.place}>
                          {loc.place}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-blue-700 font-semibold">+{loc.distance_km.toFixed(1)} km</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{formatDate(loc.arrival_time)}</td>
                        <td className="px-4 py-2.5 font-mono font-medium">{loc.temperature_c.toFixed(1)}°C</td>
                        <td className="px-4 py-2.5 font-mono font-medium">{loc.humidity_percent}%</td>
                        <td className="px-4 py-2.5 font-mono font-medium">{loc.rain_probability_percent}%</td>
                        <td className="px-4 py-2.5 font-mono font-medium">{loc.wind_speed_kmh.toFixed(1)} km/h</td>
                        <td className="px-4 py-2.5">{getRiskBadge(loc.risk.level)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
};

function generateSimulatedRoute(
  source: string,
  dest: string,
  departureDate: string,
  departureTime: string
): RouteAnalyzeResponse {
  const depIso = `${departureDate}T${departureTime}:00+05:30`;
  const sLower = (source || '').toLowerCase();
  const dLower = (dest || '').toLowerCase();

  let midVillage = 'Battulapalle, Sri Sathya Sai';
  let midVillage2 = 'Mudigubba, Sri Sathya Sai';
  let midVillage3 = 'Mulakalacheruvu, Annamayya';
  let dist = 176.3;

  if (sLower.includes('kadiri') || dLower.includes('kadiri')) {
    midVillage = 'Kurabalakota, Annamayya';
    midVillage2 = 'Mulakalacheruvu, Annamayya';
    midVillage3 = 'Tanakallu, Sri Sathya Sai';
    dist = 86.5;
  } else if (sLower.includes('hyderabad') || dLower.includes('hyderabad')) {
    midVillage = 'Kurnool, Kurnool Dist.';
    midVillage2 = 'Gooty, Anantapuramu';
    midVillage3 = 'Jadcherla, Mahabubnagar';
    dist = 530.3;
  }

  return {
    departure_time: depIso,
    route: {
      distance_km: dist,
      travel_time_minutes: Math.round((dist / 55) * 60),
      estimated_travel_time_minutes: Math.round((dist / 55) * 60 * 1.2),
      estimated_travel_time_hours: Number((((dist / 55) * 60 * 1.2) / 60).toFixed(2)),
      delay_buffer_minutes: Math.round((dist / 55) * 60 * 0.2)
    },
    locations: [
      {
        place: source,
        distance_km: 0.0,
        arrival_time: depIso,
        temperature_c: 32.5,
        humidity_percent: 48,
        rain_probability_percent: 25,
        wind_speed_kmh: 16.0,
        risk: {
          level: 'low',
          score: 10,
          factors: ['no elevated weather threshold met']
        }
      },
      {
        place: midVillage,
        distance_km: Number((dist * 0.25).toFixed(1)),
        arrival_time: new Date(Date.now() + 0.75 * 3600000).toISOString(),
        temperature_c: 33.2,
        humidity_percent: 52,
        rain_probability_percent: 65,
        wind_speed_kmh: 22.5,
        risk: {
          level: 'moderate',
          score: 30,
          factors: ['moderate rain chance']
        }
      },
      {
        place: midVillage2,
        distance_km: Number((dist * 0.50).toFixed(1)),
        arrival_time: new Date(Date.now() + 1.5 * 3600000).toISOString(),
        temperature_c: 32.0,
        humidity_percent: 55,
        rain_probability_percent: 75,
        wind_speed_kmh: 24.0,
        risk: {
          level: 'moderate',
          score: 35,
          factors: ['high rain probability']
        }
      },
      {
        place: midVillage3,
        distance_km: Number((dist * 0.75).toFixed(1)),
        arrival_time: new Date(Date.now() + 2.25 * 3600000).toISOString(),
        temperature_c: 30.5,
        humidity_percent: 60,
        rain_probability_percent: 45,
        wind_speed_kmh: 20.0,
        risk: {
          level: 'low',
          score: 15,
          factors: ['no elevated weather threshold met']
        }
      },
      {
        place: dest,
        distance_km: dist,
        arrival_time: new Date(Date.now() + 3.0 * 3600000).toISOString(),
        temperature_c: 29.8,
        humidity_percent: 62,
        rain_probability_percent: 30,
        wind_speed_kmh: 18.0,
        risk: {
          level: 'low',
          score: 12,
          factors: ['no elevated weather threshold met']
        }
      }
    ],
    overall_risk: {
      level: 'moderate',
      score: 35,
      highest_risk_places: [midVillage2],
      method: 'Rule-based weather risk using temperature, humidity, rain probability, and wind speed.'
    }
  };
}
