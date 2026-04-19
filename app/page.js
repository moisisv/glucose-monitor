"use client";

import { useState, useEffect, useRef } from "react";
import * as Chart from "chart.js/auto";

// Custom SVG icons


const ArrowRightIcon = ({ className = "w-6 h-6", style }) => (
  <svg
    className={className}
    style={style}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14 5l7 7m0 0l-7 7m7-7H3"
    />
  </svg>
);

// Constants
const TREND_ARROWS = {
  DOWN: 1,
  DOWN_DIAGONAL: 2,
  FLAT: 3,
  UP_DIAGONAL: 4,
  UP: 5,
};

const COLORS = {
  LOW: 0,
  NORMAL: 1,
  MODERATE: 2,
  HIGH: 3,
};

const STATUS_TEXT = {
  [COLORS.LOW]: "Low",
  [COLORS.NORMAL]: "Normal",
  [COLORS.MODERATE]: "Moderate",
  [COLORS.HIGH]: "High",
};

const COLOR_CLASSES = {
  [COLORS.LOW]: "text-red-500",
  [COLORS.NORMAL]: "text-green-500",
  [COLORS.MODERATE]: "text-yellow-500",
  [COLORS.HIGH]: "text-red-500",
};

const GRADIENT_CLASSES = {
  [COLORS.LOW]: "from-red-50 to-red-100",
  [COLORS.NORMAL]: "from-green-50 to-green-100",
  [COLORS.MODERATE]: "from-yellow-50 to-yellow-100",
  [COLORS.HIGH]: "from-red-50 to-red-100",
};

const TEXT_COLOR_CLASSES = {
  [COLORS.LOW]: "text-red-600",
  [COLORS.NORMAL]: "text-green-600",
  [COLORS.MODERATE]: "text-yellow-600",
  [COLORS.HIGH]: "text-red-600",
};

// Utility functions
const parseTimestamp = (timestampStr) => {
  const [datePart, timePart, ampm] = timestampStr.split(" ");
  const [month, day, year] = datePart.split("/").map(Number);
  let [hour, minute, second] = timePart.split(":").map(Number);

  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  return new Date(year, month - 1, day, hour, minute, second).getTime();
};

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateTime = (timestamp) => {
  return new Date(timestamp).toLocaleString();
};

const calculateEstimation = (data) => {
  if (data.length === 0) return [];
  const latest = data[data.length - 1];
  const calculateFrom = latest.timestamp - 45 * 60 * 1000;
  const recentData = data.filter((d) => d.timestamp >= calculateFrom);

  let slope = 0;
  if (recentData.length >= 2) {
    const n = recentData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const firstTimestamp = recentData[0].timestamp;

    recentData.forEach((d) => {
      const x = (d.timestamp - firstTimestamp) / (60 * 1000); // minutes since first point
      const y = d.glucose;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });

    const denominator = n * sumXX - sumX * sumX;
    if (denominator !== 0) {
      slope = (n * sumXY - sumX * sumY) / denominator;
    }
  }

  const estimations = [];
  for (let i = 1; i <= 3; i++) {
    const minutesAhead = i * 15;
    const estTimestamp = latest.timestamp + minutesAhead * 60 * 1000;
    const latestX = (latest.timestamp - (recentData[0]?.timestamp || latest.timestamp)) / (60 * 1000);
    const estGlucose = Math.round(latest.glucose + slope * minutesAhead);

    estimations.push({
      timestamp: estTimestamp,
      glucose: Math.max(40, Math.min(400, estGlucose)), // keep it in reasonable bounds
      isEstimation: true,
    });
  }

  return estimations;
};

// Map trend arrow to 5-state rotation
const getTrendArrowIcon = (arrow) => {
  const className = "w-6 h-6";
  const rotationMap = {
    [TREND_ARROWS.UP]: "-90deg", // point up
    [TREND_ARROWS.UP_DIAGONAL]: "-45deg", // display increase
    [TREND_ARROWS.FLAT]: "0deg", // static
    [TREND_ARROWS.DOWN_DIAGONAL]: "45deg", // display decrease
    [TREND_ARROWS.DOWN]: "90deg", // point down
  };
  const rotation = rotationMap[arrow] ?? "0deg";
  return (
    <ArrowRightIcon
      className={className}
      style={{ transform: `rotate(${rotation})` }}
    />
  );
};

// Components
const LoadingState = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
    <div className="text-center text-indigo-600 dark:text-indigo-400">
      <p className="text-xl text-gray-700 dark:text-gray-300">Loading glucose data...</p>
    </div>
  </div>
);

const ErrorState = ({ error, onRetry, onLogin }) => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 max-w-md w-full border border-gray-100 dark:border-slate-700 text-center">
      <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
        Connection Error
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
        {error || "We couldn't fetch your glucose data. This might be due to an expired session or network issues."}
      </p>
      <div className="flex flex-col gap-3">
        <button
          onClick={onRetry}
          className="w-full bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 active:scale-[0.98] transition shadow-lg shadow-indigo-500/20"
        >
          Try Again
        </button>
        <button
          onClick={onLogin}
          className="w-full bg-white dark:bg-slate-700 text-gray-700 dark:text-white px-6 py-3 rounded-xl font-semibold border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 active:scale-[0.98] transition"
        >
          Sign In Again
        </button>
      </div>
    </div>
  </div>
);

const LoginModal = ({ isOpen, onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (response.ok) {
        onLogin();
      } else {
        setError(result.error || "Login failed");
      }
    } catch (err) {
      setError("An error occurred. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full border border-gray-100 dark:border-slate-700 animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Welcome Back</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Login with your Libreview account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email Address</label>
            <input
              type="email"
              required
              placeholder="name@example.com"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-600 dark:bg-slate-700/50 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-600 dark:bg-slate-700/50 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 active:scale-[0.98] transition disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-indigo-500/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Authenticating...
              </span>
            ) : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
};

const LatestReading = ({ reading }) => (
  <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-xl p-6 mb-6">
    <div className="flex items-start justify-between flex-wrap gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Current Reading</p>
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`text-5xl font-bold ${COLOR_CLASSES[reading.color]}`}
          >
            {reading.glucose}
          </span>
          <span className="text-2xl text-gray-500 dark:text-gray-400">mg/dL</span>
          <div className={COLOR_CLASSES[reading.color]}>
            {getTrendArrowIcon(reading.trend)}
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {formatDateTime(reading.timestamp)}
        </p>
      </div>
      <div className="text-right">
        <div className="inline-block px-4 py-2 rounded-lg bg-white dark:bg-slate-950 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
          <p
            className={`text-lg font-semibold ${COLOR_CLASSES[reading.color]}`}
          >
            {STATUS_TEXT[reading.color]}
          </p>
        </div>
      </div>
    </div>
  </div>
);

const GlucoseChart = ({ data, estimationData, currentTime }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    const ctx = chartRef.current.getContext("2d");

    const updateChart = () => {
      if (chartInstance.current) chartInstance.current.destroy();

      const isDarkMode =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;

      const gridColor = isDarkMode ? "#334155" : "#e5e7eb"; // slate-700 : gray-200
      const tickColor = isDarkMode ? "#94a3b8" : "#6b7280"; // slate-400 : gray-500

      const referenceLinesPlugin = {
        id: "referenceLines",
        afterDatasetsDraw: (chart) => {
          const {
            ctx,
            chartArea: { left, right },
            scales: { y },
          } = chart;

          ctx.save();
          // Very High line
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          const veryHighY = y.getPixelForValue(240);
          ctx.beginPath();
          ctx.moveTo(left, veryHighY);
          ctx.lineTo(right, veryHighY);
          ctx.stroke();

          // High line
          ctx.strokeStyle = "#f97316";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          const highY = y.getPixelForValue(180);
          ctx.beginPath();
          ctx.moveTo(left, highY);
          ctx.lineTo(right, highY);
          ctx.stroke();

          // Low line
          ctx.strokeStyle = "#22c55e";
          const lowY = y.getPixelForValue(70);
          ctx.beginPath();
          ctx.moveTo(left, lowY);
          ctx.lineTo(right, lowY);
          ctx.stroke();
          ctx.restore();
        },
      };

      chartInstance.current = new Chart.Chart(ctx, {
        type: "line",
        data: {
          datasets: [
            {
              label: "Glucose",
              data: data.map((d) => ({ x: d.timestamp, y: d.glucose })),
              borderColor: "#6366f1",
              backgroundColor: "rgba(99, 102, 241, 0.1)",
              borderWidth: 3,
              pointRadius: 4,
              pointHoverRadius: 6,
              tension: 0.4,
            },
            {
              label: "Estimation",
              data: [
                ...(data.length > 0 ? [{ x: data[data.length - 1].timestamp, y: data[data.length - 1].glucose }] : []),
                ...estimationData.map((d) => ({ x: d.timestamp, y: d.glucose }))
              ],
              borderColor: "#94a3b8",
              backgroundColor: "transparent",
              borderWidth: 2,
              borderDash: [5, 5],
              pointRadius: 4,
              pointStyle: 'circle',
              pointHoverRadius: 6,
              tension: 0, // Dot line should be straight between points for clarity
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (context) => {
                  const d = context[0].datasetIndex === 0
                    ? data[context[0].dataIndex]
                    : (context[0].dataIndex === 0 ? data[data.length - 1] : estimationData[context[0].dataIndex - 1]);
                  return d ? formatDateTime(d.timestamp) : "";
                },
                label: (context) => {
                  const label = context.dataset.label || "";
                  return `${label}: ${context.parsed.y} mg/dL`;
                },
              },
            },
          },
          scales: {
            x: {
              type: "linear",
              min: currentTime - 6 * 60 * 60 * 1000,
              max: currentTime + 45 * 60 * 1000,
              grid: { color: gridColor },
              ticks: {
                maxRotation: 45,
                minRotation: 45,
                color: tickColor,
                callback: (value) => formatTime(value),
              },
            },
            y: {
              min: 50,
              max: 300,
              grid: { color: gridColor },
              ticks: {
                callback: (v) => `${v}`,
                color: tickColor,
              },
            },
          },
        },
        plugins: [referenceLinesPlugin],
      });
    };

    updateChart();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => updateChart();
    mediaQuery.addEventListener("change", handler);

    return () => {
      if (chartInstance.current) chartInstance.current.destroy();
      mediaQuery.removeEventListener("change", handler);
    };
  }, [data, estimationData, currentTime]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 mb-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
        Glucose Levels Over Time
      </h2>
      <div style={{ width: "100%", height: "300px" }}>
        <canvas ref={chartRef}></canvas>
      </div>
    </div>
  );
};

const SummaryCards = ({ data }) => {
  const labels = ["Low", "In Range", "Moderate", "High"];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
      {[COLORS.LOW, COLORS.NORMAL, COLORS.MODERATE, COLORS.HIGH].map((color, idx) => (
        <div
          key={color}
          className={`bg-gradient-to-br ${GRADIENT_CLASSES[color]} dark:bg-none dark:bg-slate-800 rounded-lg p-4`}
        >
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{labels[idx]}</p>
          <p className={`text-2xl font-bold ${TEXT_COLOR_CLASSES[color]}`}>
            {data.filter((d) => d.color === color).length}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">readings</p>
        </div>
      ))}
    </div>
  );
};

export default function GlucoseDashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [latestReading, setLatestReading] = useState(null);
  const [estimationData, setEstimationData] = useState([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isTabFocused, setIsTabFocused] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/glucose");

      if (response.status === 401) {
        setShowLogin(true);
        return;
      }

      if (!response.ok) throw new Error("Failed to fetch data");

      const result = await response.json();
      if (!Array.isArray(result)) throw new Error("Unexpected API format");

      const now = Date.now();
      const sixHoursAgo = now - 6 * 60 * 60 * 1000;

      const parsedData = result
        .map((item) => {
          const glucoseValue = item.ValueInMgPerDl ?? item.Value;
          return {
            ...item,
            timestamp: parseTimestamp(item.Timestamp),
            glucose: glucoseValue,
            color: glucoseValue < 70 ? COLORS.LOW : (item.MeasurementColor ?? 1),
            trend: item.TrendArrow ?? 3, // default to FLAT
          };
        })
        .filter((item) => item.timestamp >= sixHoursAgo)
        .sort((a, b) => a.timestamp - b.timestamp);

      setData(parsedData);
      setLatestReading(parsedData[parsedData.length - 1] || null);
      setEstimationData(calculateEstimation(parsedData));
      setCurrentTime(now);
      setError(null);
      setShowLogin(false);
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
    fetchData();
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabFocused(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!isTabFocused) return;

    fetchData();
    const interval = setInterval(fetchData, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [isTabFocused]);

  if (loading && data.length === 0 && !showLogin) return <LoadingState />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-950 dark:to-slate-900 p-4 md:p-8">
      {error ? (
        <ErrorState error={error} onRetry={fetchData} onLogin={() => setShowLogin(true)} />
      ) : (
        <div className="max-w-7xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                  Glucose Tracker
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-200 px-4 py-2 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition text-sm font-medium disabled:opacity-50"
                >
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
                <a
                  href="/unauthorized"
                  className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition text-sm font-medium border border-red-100 dark:border-red-900/30"
                >
                  Sign Out
                </a>
              </div>
            </div>

            {latestReading && <LatestReading reading={latestReading} />}
            <GlucoseChart data={data} estimationData={estimationData} currentTime={currentTime} />
            <SummaryCards data={data} />
          </div>
        </div>
      )}
      <LoginModal isOpen={showLogin} onLogin={handleLoginSuccess} />
    </div>
  );
}
