import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API from "../api/axios";

const Home = () => {
  const [url, setUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [expiresIn, setExpiresIn] = useState("");
  const [result, setResult] = useState(null);
  const [lookup, setLookup] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleShorten = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await API.post("/api/shorten", {
        originalUrl: url,
        alias: alias || undefined,
        expiresIn: expiresIn || undefined,
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async () => {
    setLookupResult(null);
    try {
      const code = lookup.split("/").pop();
      const res = await API.get(`/api/lookup/${code}`);
      setLookupResult(res.data);
    } catch (err) {
      setLookupResult({ error: "URL not found" });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] pt-20">
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Shorten Links. Generate QR. <span className="text-indigo-600">Track Everything.</span>
          </h1>
          <p className="text-gray-500 text-lg">
            A powerful URL shortener built for modern creators and developers.
          </p>
        </div>

        {/* Shorten Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          {/* URL Input */}
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste your long URL here..."
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleShorten}
              disabled={loading}
              className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Shortening..." : "⚡ Shorten"}
            </button>
          </div>

          {/* Toggle Advanced Options */}
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="text-sm text-gray-500 hover:text-indigo-600 transition-colors mb-4"
          >
            {showOptions ? "▲ Hide options" : "▼ Custom alias & expiry"}
          </button>

          {/* Advanced Options */}
          {showOptions && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                  Custom Alias
                </label>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="e.g. mysummer25"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                  Expires In (days)
                </label>
                <select
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Never expires</option>
                  <option value="1">1 Day</option>
                  <option value="7">7 Days</option>
                  <option value="30">30 Days</option>
                </select>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Your short URL</p>
                <a
                  href={result.shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 font-bold text-lg hover:underline font-mono"
                >
                  {result.shortUrl}
                </a>
                <p className="text-xs text-gray-400 mt-1 truncate max-w-sm">
                  {result.originalUrl}
                </p>
              </div>
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-white border border-indigo-200 text-indigo-600 font-medium rounded-lg hover:bg-indigo-50 transition-colors text-sm"
              >
                {copied ? "✅ Copied!" : "📋 Copy Link"}
              </button>
            </div>
          )}
        </div>

        {/* Lookup Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">🔍 Reverse Lookup</h2>
          <p className="text-sm text-gray-500 mb-4">
            Enter a short URL to find the original long URL.
          </p>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder="Enter short URL or code..."
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleLookup}
              className="px-6 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-700 transition-colors"
            >
              Lookup
            </button>
          </div>

          {/* Lookup Result */}
          {lookupResult && (
            <div className={`mt-4 p-4 rounded-xl border ${lookupResult.error ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
              {lookupResult.error ? (
                <p className="text-red-600 text-sm">{lookupResult.error}</p>
              ) : (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Original URL</p>
                  <a
                    href={lookupResult.originalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-green-700 font-medium text-sm hover:underline break-all"
                  >
                    {lookupResult.originalUrl}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Home;