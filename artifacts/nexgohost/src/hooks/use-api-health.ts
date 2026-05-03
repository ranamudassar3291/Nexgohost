import { useState, useEffect, useCallback, useRef } from "react";

const HEALTH_URL = "/api/config";
const CHECK_INTERVAL_MS = 20_000;
const FAILURE_THRESHOLD = 2;
const INITIAL_DELAY_MS = 4_000;

export function useApiHealth() {
  const [isDown, setIsDown] = useState(false);
  const failureCount = useRef(0);
  const isDownRef = useRef(false);

  const check = useCallback(async () => {
    try {
      const res = await fetch(HEALTH_URL, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        failureCount.current = 0;
        if (isDownRef.current) {
          isDownRef.current = false;
          setIsDown(false);
        }
      } else {
        failureCount.current += 1;
        if (failureCount.current >= FAILURE_THRESHOLD && !isDownRef.current) {
          isDownRef.current = true;
          setIsDown(true);
        }
      }
    } catch {
      failureCount.current += 1;
      if (failureCount.current >= FAILURE_THRESHOLD && !isDownRef.current) {
        isDownRef.current = true;
        setIsDown(true);
      }
    }
  }, []);

  useEffect(() => {
    const init = setTimeout(check, INITIAL_DELAY_MS);
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      clearTimeout(init);
      clearInterval(interval);
    };
  }, [check]);

  const retry = useCallback(() => {
    failureCount.current = 0;
    isDownRef.current = false;
    setIsDown(false);
    check();
  }, [check]);

  return { isDown, retry };
}
