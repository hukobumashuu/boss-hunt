import { useEffect, useState } from "react";

const TIME_ZONE = "Asia/Manila";

const formatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="clock">
      <span className="clock__time">{formatter.format(now)}</span>
      <span className="clock__label">Philippine time</span>
    </div>
  );
}
