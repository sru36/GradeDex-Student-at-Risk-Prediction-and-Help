export function FloatingClouds() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div className="absolute top-[10%] left-[-20%] animate-float-slow opacity-90">
        <CloudSVG className="w-48 h-auto text-white drop-shadow-2xl" />
      </div>
      <div className="absolute top-[30%] left-[-10%] animate-float-medium opacity-80 scale-75">
        <CloudSVG className="w-64 h-auto text-white drop-shadow-xl" />
      </div>
      <div className="absolute top-[60%] left-[-30%] animate-float-fast opacity-100 scale-125">
        <CloudSVG className="w-56 h-auto text-white drop-shadow-2xl" />
      </div>
      <div className="absolute top-[80%] left-[-15%] animate-float-slow opacity-70 scale-150" style={{ animationDelay: '-20s' }}>
        <CloudSVG className="w-72 h-auto text-white drop-shadow-lg" />
      </div>
      <div className="absolute top-[20%] left-[-40%] animate-float-medium opacity-85 scale-90" style={{ animationDelay: '-15s' }}>
        <CloudSVG className="w-40 h-auto text-white drop-shadow-xl" />
      </div>
    </div>
  );
}

function CloudSVG({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.5 19C19.9853 19 22 16.9853 22 14.5C22 12.1325 20.1772 10.2016 17.8576 10.011C17.3916 7.18259 14.9463 5 12 5C9.36688 5 7.14924 6.81463 6.34751 9.21319C3.93179 9.49392 2 11.5268 2 14C2 16.7614 4.23858 19 7 19H17.5Z" />
    </svg>
  );
}
