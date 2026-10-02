import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/axios";

const Analytics = () => {
  const { code } = useParams();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await API.get(`/api/stats/${code}`);
      setStats(res.data);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] pt-20 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] pt-20 flex items-center justify-center">
        <p className="text-gray-500">URL not found</p>
      </div>
    );
  }

  // Count browsers
  const browserCount = stats.analytics.reduce((acc, item) => {
    acc[item.browser] = (acc[item.browser] || 0) + 1;
    return acc;
  }, {});

  // Count devices
  const deviceCount = stats.analytics.reduce((acc, item) => {
    acc[item.device] = (acc[item.device] || 0) + 1;
    return acc;
  }, {});

  // Count OS
  const osCount = stats.analytics.reduce((acc, item) => {
    acc[item.os] = (acc[item.os] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#f8f9ff] pt-20">
      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Link Analytics</h1>
            <p className="text-gray-500 text-sm mt-1 font-mono">{code}</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Total Clicks</p>
            <p className="text-3xl font-bold text-indigo-600">{stats.clicks}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Created At</p>
            <p className="text-lg font-bold text-gray-900">
              {new Date(stats.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Expires At</p>
            <p className="text-lg font-bold text-gray-900">
              {new Date(stats.expiresAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Original URL */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
          <p className="text-sm text-gray-500 mb-1">Original URL</p>
          <a
            href={stats.originalUrl}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 hover:underline break-all"
          >
            {stats.originalUrl}
          </a>
        </div>

        {/* Analytics Breakdown */}
        {stats.analytics.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 shadow-sm text-center">
            <p className="text-gray-400 text-lg">No clicks yet!</p>
            <p className="text-gray-400 text-sm mt-1">
              Share your link to start tracking analytics.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Browser Breakdown */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">🌐 Browsers</h3>
              <div className="flex flex-col gap-3">
                {Object.entries(browserCount).map(([browser, count]) => (
                  <div key={browser}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{browser}</span>
                      <span className="font-semibold text-gray-900">{count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{ width: `${(count / stats.clicks) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Device Breakdown */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">📱 Devices</h3>
              <div className="flex flex-col gap-3">
                {Object.entries(deviceCount).map(([device, count]) => (
                  <div key={device}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{device}</span>
                      <span className="font-semibold text-gray-900">{count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${(count / stats.clicks) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* OS Breakdown */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">💻 Operating Systems</h3>
              <div className="flex flex-col gap-3">
                {Object.entries(osCount).map(([os, count]) => (
                  <div key={os}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{os}</span>
                      <span className="font-semibold text-gray-900">{count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full"
                        style={{ width: `${(count / stats.clicks) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recent Clicks */}
        {stats.analytics.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm mt-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Recent Clicks</h3>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Browser</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Device</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">OS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.analytics.slice().reverse().map((click, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {new Date(click.clickedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900">{click.browser}</td>
                    <td className="px-6 py-3 text-sm text-gray-900">{click.device}</td>
                    <td className="px-6 py-3 text-sm text-gray-900">{click.os}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;