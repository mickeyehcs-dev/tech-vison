import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { SensorLog } from '../../types';
import { formatTime } from '../../utils/formatters';

export interface TelemetryMultiChartProps {
  logs: SensorLog[];
  height?: number;
}

export const TelemetryMultiChart: React.FC<TelemetryMultiChartProps> = ({ logs, height = 300 }) => {
  if (!logs || logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-400">
        No telemetry readings available for charting
      </div>
    );
  }

  const chartData = logs.map((log) => ({
    time: formatTime(log.recorded_at),
    temperature: Number(log.temperature),
    humidity: Number(log.humidity),
    riskScore: Number(log.score),
    methane: Number(log.methane),
    co2: Number(log.co2)
  }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 11 }} />
          <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              borderColor: '#e2e8f0',
              borderRadius: '0.75rem',
              color: '#0f172a',
              fontSize: '12px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
          <Line
            type="monotone"
            dataKey="temperature"
            name="Temp (°C)"
            stroke="#ea580c"
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="humidity"
            name="Humidity (%)"
            stroke="#0284c7"
            strokeWidth={2}
            dot={{ r: 2 }}
          />
          <Line
            type="monotone"
            dataKey="riskScore"
            name="Spoilage Score"
            stroke="#e11d48"
            strokeWidth={2.5}
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
