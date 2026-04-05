import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MultimeterReading } from '../types';
import { CHART_WINDOW_SIZE } from '../constants';

interface HistoryChartProps {
  history: MultimeterReading[];
}

export const HistoryChart: React.FC<HistoryChartProps> = ({ history }) => {
  // Only take the last N points
  const data = history.slice(-CHART_WINDOW_SIZE).map((h, i) => ({
    time: i,
    value: h.value,
  }));

  if (data.length === 0) return null;

  return (
    <div className="w-full h-48 bg-slate-900/50 rounded-lg border border-slate-800 p-4 mt-4">
      <h3 className="text-xs uppercase text-slate-500 font-bold mb-2 tracking-wider">Signal History</h3>
      <div className="w-full h-full">
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="time" hide />
            <YAxis 
                domain={['auto', 'auto']} 
                stroke="#475569" 
                tick={{fontSize: 10}}
                width={30}
            />
            <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }}
                itemStyle={{ color: '#22d3ee' }}
                labelStyle={{ display: 'none' }}
            />
            <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#22d3ee" 
                strokeWidth={2} 
                dot={false} 
                animationDuration={300}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};