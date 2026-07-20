interface WeatherIllustrationProps {
  condition?: string;
}

export default function WeatherIllustration({ condition = "Partly cloudy" }: WeatherIllustrationProps) {
  const getIllustration = (cond: string) => {
    const lower = cond.toLowerCase();

    if (lower.includes("rain")) {
      return (
        <svg viewBox="0 0 200 140" className="w-full h-auto">
          {/* Cloud */}
          <ellipse cx="100" cy="50" rx="50" ry="35" fill="#F3ECE1" stroke="#8F8577" strokeWidth="2" />
          <ellipse cx="70" cy="60" rx="35" ry="30" fill="#F3ECE1" stroke="#8F8577" strokeWidth="2" />
          <ellipse cx="130" cy="60" rx="40" ry="32" fill="#F3ECE1" stroke="#8F8577" strokeWidth="2" />

          {/* Rain drops */}
          <g className="animate-bounce" style={{ animationDuration: "1.5s" }}>
            <line x1="60" y1="90" x2="55" y2="105" stroke="#AD8A64" strokeWidth="3" strokeLinecap="round" />
            <line x1="90" y1="95" x2="85" y2="110" stroke="#AD8A64" strokeWidth="3" strokeLinecap="round" />
            <line x1="120" y1="90" x2="115" y2="105" stroke="#AD8A64" strokeWidth="3" strokeLinecap="round" />
            <line x1="150" y1="95" x2="145" y2="110" stroke="#AD8A64" strokeWidth="3" strokeLinecap="round" />
          </g>
        </svg>
      );
    } else if (lower.includes("cloud")) {
      return (
        <svg viewBox="0 0 200 140" className="w-full h-auto">
          {/* Clouds */}
          <ellipse cx="70" cy="60" rx="45" ry="35" fill="#EADFCF" stroke="#8F8577" strokeWidth="2" />
          <ellipse cx="130" cy="60" rx="50" ry="38" fill="#EADFCF" stroke="#8F8577" strokeWidth="2" />
          <ellipse cx="100" cy="45" rx="55" ry="32" fill="#EADFCF" stroke="#8F8577" strokeWidth="2" />
        </svg>
      );
    } else if (lower.includes("sunny") || lower.includes("clear")) {
      return (
        <svg viewBox="0 0 200 140" className="w-full h-auto">
          {/* Sun circle with animation */}
          <circle cx="100" cy="50" r="35" fill="#EADFCF" stroke="#AD8A64" strokeWidth="2" className="animate-pulse" />

          {/* Sun rays */}
          <g stroke="#AD8A64" strokeWidth="2" strokeLinecap="round">
            <line x1="100" y1="10" x2="100" y2="2" className="animate-pulse" style={{ animationDuration: "2s" }} />
            <line x1="100" y1="90" x2="100" y2="98" className="animate-pulse" style={{ animationDuration: "2s" }} />
            <line x1="40" y1="50" x2="32" y2="50" className="animate-pulse" style={{ animationDuration: "2s" }} />
            <line x1="160" y1="50" x2="168" y2="50" className="animate-pulse" style={{ animationDuration: "2s" }} />
            <line x1="55" y1="25" x2="50" y2="20" className="animate-pulse" style={{ animationDuration: "2s" }} />
            <line x1="145" y1="80" x2="150" y2="85" className="animate-pulse" style={{ animationDuration: "2s" }} />
          </g>
        </svg>
      );
    } else if (lower.includes("snow")) {
      return (
        <svg viewBox="0 0 200 140" className="w-full h-auto">
          {/* Cloud */}
          <ellipse cx="100" cy="50" rx="50" ry="35" fill="#F3ECE1" stroke="#D9C7AE" strokeWidth="2" />
          <ellipse cx="70" cy="60" rx="35" ry="30" fill="#F3ECE1" stroke="#D9C7AE" strokeWidth="2" />
          <ellipse cx="130" cy="60" rx="40" ry="32" fill="#F3ECE1" stroke="#D9C7AE" strokeWidth="2" />

          {/* Snowflakes */}
          <g className="animate-pulse" fill="#D9C7AE">
            <circle cx="60" cy="100" r="3" />
            <circle cx="90" cy="105" r="3" />
            <circle cx="120" cy="100" r="3" />
            <circle cx="150" cy="105" r="3" />
            <circle cx="75" cy="120" r="3" />
            <circle cx="125" cy="120" r="3" />
          </g>
        </svg>
      );
    } else if (lower.includes("wind")) {
      return (
        <svg viewBox="0 0 200 140" className="w-full h-auto">
          {/* Wind lines - animated */}
          <g stroke="#8F8577" strokeWidth="3" strokeLinecap="round">
            <line x1="20" y1="50" x2="80" y2="50" className="animate-pulse" style={{ animationDuration: "1s" }} />
            <line x1="40" y1="70" x2="120" y2="70" className="animate-pulse" style={{ animationDuration: "1.2s" }} />
            <line x1="30" y1="90" x2="100" y2="90" className="animate-pulse" style={{ animationDuration: "1.4s" }} />
          </g>
        </svg>
      );
    }

    // Default: partly cloudy
    return (
      <svg viewBox="0 0 200 140" className="w-full h-auto">
        {/* Sun */}
        <circle cx="140" cy="40" r="28" fill="#EADFCF" stroke="#AD8A64" strokeWidth="2" />

        {/* Cloud */}
        <ellipse cx="80" cy="70" rx="45" ry="32" fill="#F3ECE1" stroke="#D9C7AE" strokeWidth="2" />
        <ellipse cx="50" cy="80" rx="32" ry="28" fill="#F3ECE1" stroke="#D9C7AE" strokeWidth="2" />
        <ellipse cx="110" cy="80" rx="38" ry="30" fill="#F3ECE1" stroke="#D9C7AE" strokeWidth="2" />
      </svg>
    );
  };

  return (
    <div className="w-32 h-32 flex items-center justify-center">
      {getIllustration(condition)}
    </div>
  );
}
