'use client';

interface SplashScreenProps {
  projectName: string;
  progress: number;
  fadeDuration: number;
}

export function SplashScreen({
  projectName,
  progress,
  fadeDuration,
}: SplashScreenProps) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-gray-950 transition-opacity"
      style={{
        transitionDuration: `${fadeDuration}ms`,
      }}
    >
      <div
        className="flex flex-col items-center text-center px-4 sm:px-6"
        style={{
          width: 'min(100%, 28rem)',
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <h1 className="text-white text-2xl sm:text-3xl font-semibold mb-4 flex flex-wrap items-baseline justify-center gap-2">
          <span className="text-[0.7em]">CONCEPTFAB</span>
          <span className="text-white/80 text-[0.91em] font-normal">
            Pano{' '}
            <span className="text-sm sm:text-[15px]">
              v: {process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'}
            </span>
          </span>
        </h1>
        <p className="text-zinc-400 text-2xl sm:text-4xl font-thin mb-6 sm:mb-8 w-full text-center">
          {projectName}
        </p>

        <div className="w-full max-w-[16rem] h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-zinc-500 text-sm mt-4 w-full text-center animate-pulse">
          Ładowanie panoram…
        </p>
      </div>
    </div>
  );
}
