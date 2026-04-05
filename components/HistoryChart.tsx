import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MultimeterReading } from '../types';
import { CHART_WINDOW_SIZE } from '../constants';

interface HistoryChartProps {
  history: MultimeterReading[];
}

export const HistoryChart: React.FC<HistoryChartProps> = ({ history }) => {
  const data = history.slice(-CHART_WINDOW_SIZE).map((h, i) => ({
    time: i,
    value: h.value,
    mode: h.mode,
    unit: h.unit,
  }));

  if (data.length === 0) return null;

  return (
    <div className="history-shell">
      <div className="panel-header">
        <div>
          <span className="panel-kicker">Signal Trace</span>
          <h3 className="chat-title">Measurement History</h3>
        </div>
        <div className="hud-chip">{data.length} Samples</div>
      </div>

      <div className="chart-card">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(54,243,210,0.16)" />
            <XAxis dataKey="time" hide />
            <YAxis 
                domain={['auto', 'auto']} 
                stroke="#5b9088" 
                tick={{ fontSize: 10, fill: '#8eb2aa' }}
                width={30}
            />
            <Tooltip 
                contentStyle={{ backgroundColor: '#03101e', borderColor: 'rgba(54,243,210,0.3)', color: '#d7fff3' }}
                itemStyle={{ color: '#36f3d2' }}
                labelStyle={{ color: '#8eb2aa' }}
                formatter={(value: number, _name, payload) => [`${value} ${payload?.payload?.unit ?? ''}`, payload?.payload?.mode ?? 'Reading']}
             />
            <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#36f3d2" 
                strokeWidth={2.5} 
                dot={false} 
                animationDuration={300}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <table className="history-table">
        <thead>
          <tr>
            <th>Mode</th>
            <th>Value</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(-5).reverse().map((entry) => (
            <tr key={`${entry.time}-${entry.mode}`}>
              <td>{entry.mode}</td>
              <td>{entry.value}</td>
              <td>{entry.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
