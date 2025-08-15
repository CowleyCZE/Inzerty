import React from 'react';

const AdCard = ({ ad }) => (
  <div className="bg-slate-700 rounded-lg shadow-xl overflow-hidden transform hover:scale-105 transition-transform duration-300 flex flex-col">
    <img 
        src={ad.image_url} 
        alt={ad.title} 
        className="w-full h-48 object-cover" 
        onError={(e) => { e.currentTarget.src = 'https://picsum.photos/seed/fallback/300/200'; }}
    />
    <div className="p-5 flex flex-col flex-grow">
      <h3 className="text-lg font-semibold text-sky-400 mb-2 truncate" title={ad.title}>{ad.title}</h3>
      <p className="text-2xl font-bold text-amber-400 mb-2">{ad.price}</p>
      <p className="text-sm text-slate-300 mb-1 flex items-center">
        <LocationPinIcon /> {ad.location}
      </p>
      <p className="text-xs text-slate-400 mb-3 flex items-center">
        <CalendarIcon /> {ad.date_posted} 
        {ad.is_top && <span className="ml-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">TOP</span>}
      </p>
      <p className="text-sm text-slate-300 mb-4 flex-grow h-12 overflow-hidden text-ellipsis line-clamp-2" title={ad.description}>{ad.description}</p>
      <div className="mt-auto flex justify-between items-center text-xs text-slate-400">
        <span>{ad.views || 'N/A'} zobrazení</span>
        <a 
          href={ad.url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="px-3 py-1 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm"
        >
          Detail
        </a>
      </div>
    </div>
  </div>
);


const ResultsDisplay = ({ ads, isLoading }) => {
  if (isLoading) {
    return (
      <div className="mt-8 text-center p-10">
        <SpinnerIcon />
        <p className="text-slate-300 text-lg mt-4">Generuji ukázková data...</p>
      </div>
    );
  }

  if (ads.length === 0) {
    return (
      <div className="mt-8 p-6 bg-slate-800 rounded-lg shadow-inner text-center">
        <InfoIcon />
        <p className="text-slate-400 text-lg mt-2">Nebyly nalezeny žádné inzeráty. Nakonfigurujte a spusťte scrapování.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-semibold text-sky-400 mb-6 border-b border-slate-700 pb-3 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="hero-icon w-6 h-6 mr-2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
        </svg>
        Výsledky Scrapování ({ads.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ads.map(ad => (
          <AdCard key={ad.id} ad={ad} />
        ))}
      </div>
    </div>
  );
};

const LocationPinIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1.5 text-slate-500">
    <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.145l.002-.001L10 18.46l-.39.221-.002.001.018.008.006.003ZM10 11.25a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" clipRule="evenodd" />
    <path fillRule="evenodd" d="M12.552 1.106A8.5 8.5 0 0 0 10 0c-4.694 0-8.5 3.806-8.5 8.5 0 2.22.863 4.244 2.274 5.795l.24.261A55.717 55.717 0 0 0 9.45 18.41a1.752 1.752 0 0 0 1.099 0A55.74 55.74 0 0 0 17.228 14.57A8.474 8.474 0 0 0 18.5 8.5c0-1.01-.176-1.973-.502-2.858L17.75 1.106Z" clipRule="evenodd" />
  </svg>
);

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1.5 text-slate-500">
    <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c0-.414.336-.75.75-.75h10.5a.75.75 0 0 1 0 1.5H5.5a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
  </svg>
);

const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-sky-500 mx-auto mb-2">
    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="animate-spin mx-auto h-10 w-10 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default ResultsDisplay;