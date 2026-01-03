import React from 'react';
import { AdType, Ad } from '../types';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, colorClass = "text-sky-400" }) => (
  <div className="bg-slate-700 p-6 rounded-lg shadow-lg flex items-center space-x-4">
    <div className={`p-3 rounded-full bg-slate-800 ${colorClass} shrink-0`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-slate-400">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  </div>
);

const ChartPieIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="hero-icon w-6 h-6 mr-2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
  </svg>
);

const ChartBarSquareIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V5.25A2.25 2.25 0 0 0 18 3H6A2.25 2.25 0 0 0 3.75 5.25v12.75A2.25 2.25 0 0 0 6 20.25Z" />
  </svg>
);


const DocumentDuplicateIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
  </svg>
);

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);


interface MonitoringDashboardProps {
  ads: Ad[];
  isScraping: boolean;
  lastScrapeDuration: number | null;
}

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ ads, isScraping, lastScrapeDuration }) => {
  const totalAds = ads.length;
  const offerAds = ads.filter(ad => ad.ad_type === AdType.NABIDKA).length;
  const demandAds = ads.filter(ad => ad.ad_type === AdType.POPTAVKA).length;
  // const averagePrice = "N/A"; // Calculating average price from mixed strings is complex for this simulation

  return (
    <div className="mt-8 bg-slate-800 p-6 rounded-xl shadow-2xl">
      <h2 className="text-xl font-semibold text-sky-400 mb-6 border-b border-slate-700 pb-3 flex items-center">
        <ChartPieIcon />Přehled Monitoringu
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Celkem Inzerátů" value={isScraping && totalAds === 0 ? "Načítání..." : totalAds} icon={<DocumentDuplicateIcon />} colorClass="text-sky-400" />
        <StatCard title="Nabídky" value={isScraping && totalAds === 0 ? "Načítání..." : offerAds} icon={<ChartBarSquareIcon />} colorClass="text-green-400" />
        <StatCard title="Poptávky" value={isScraping && totalAds === 0 ? "Načítání..." : demandAds} icon={<ChartBarSquareIcon />} colorClass="text-yellow-400" />
        <StatCard title="Poslední Doba Běhu" value={lastScrapeDuration !== null ? `${lastScrapeDuration.toFixed(1)}s` : (isScraping ? "Běží..." : "N/A")} icon={<ClockIcon />} colorClass="text-purple-400" />
      </div>
      {isScraping &&
        <div className="mt-6 w-full bg-slate-700 rounded-full h-2.5">
          <div className="bg-sky-500 h-2.5 rounded-full animate-pulse" style={{ width: "75%" }}></div>
        </div>
      }
    </div>
  );
};

export default MonitoringDashboard;
