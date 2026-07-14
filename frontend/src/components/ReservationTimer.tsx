import { useEffect, useState } from 'react';

const remainingMs = (expiresAt: string) =>
  Math.max(0, new Date(expiresAt).getTime() - Date.now());

const format = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

type Props = {
  expiresAt: string;
  onExpire: () => void;
};

export default function ReservationTimer({ expiresAt, onExpire }: Props) {
  const [left, setLeft] = useState(() => remainingMs(expiresAt));

  useEffect(() => {
    const tick = setInterval(() => {
      const next = remainingMs(expiresAt);
      setLeft(next);
      if (next === 0) {
        clearInterval(tick);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [expiresAt, onExpire]);

  const urgent = left <= 60_000;

  return (
    <span className={`timer${urgent ? ' timer-urgent' : ''}`}>
      {format(left)}
    </span>
  );
}
