import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { SensorLog } from '../../types';
import { formatTime } from '../../utils/formatters';

interface SingleChartProps {
  logs: SensorLog[];
  height?: number;
}

export const TemperatureChart: React.FC<SingleChartProps> = ({ logs, height = 180 }) => {
  const data = logs.map((l) => ({
    time: formatTime(l.recorded_at),
    val: Number(l.temperature)
  }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10 }} />
          <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#0f172a' }}
            formatter={(value: any) => [`${value} °C`, 'Temperature']}
          />
          <Area type="monotone" dataKey="val" stroke="#ea580c" strokeWidth={2} fillOpacity={1} fill="url(#tempGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const HumidityChart: React.FC<SingleChartProps> = ({ logs, height = 180 }) => {
  const data = logs.map((l) => ({
    time: formatTime(l.recorded_at),
    val: Number(l.humidity)
  }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="humGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10 }} />
          <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={[0, 100]} />
          <Tooltip
            contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#0f172a' }}
            formatter={(value: any) => [`${value} %`, 'Humidity']}
          />
          <Area type="monotone" dataKey="val" stroke="#0284c7" strokeWidth={2} fillOpacity={1} fill="url(#humGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const MethaneChart: React.FC<SingleChartProps> = ({ logs, height = 180 }) => {
  const data = logs.map((l) => ({
    time: formatTime(l.recorded_at),
    val: Number(l.methane)
  }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="methGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#9333ea" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#9333ea" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10 }} />
          <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#0f172a' }}
            formatter={(value: any) => [`${value} ppm`, 'Methane Gas']}
          />
          <Area type="monotone" dataKey="val" stroke="#9333ea" strokeWidth={2} fillOpacity={1} fill="url(#methGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const CO2Chart: React.FC<SingleChartProps> = ({ logs, height = 180 }) => {
  const data = logs.map((l) => ({
    time: formatTime(l.recorded_at),
    val: Number(l.co2)
  }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="co2Grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10 }} />
          <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#0f172a' }}
            formatter={(value: any) => [`${value} ppm`, 'CO2 Concentration']}
          />
          <Area type="monotone" dataKey="val" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#co2Grad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const RiskScoreChart: React.FC<SingleChartProps> = ({ logs, height = 180 }) => {
  const data = logs.map((l) => ({
    time: formatTime(l.recorded_at),
    val: Number(l.score)
  }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#e11d48" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10 }} />
          <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={[0, 100]} />
          <Tooltip
            contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '0.75rem', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#0f172a' }}
            formatter={(value: any) => [`${value} / 100`, 'Risk Index']}
          />
          <Area type="monotone" dataKey="val" stroke="#e11d48" strokeWidth={2} fillOpacity={1} fill="url(#riskGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
