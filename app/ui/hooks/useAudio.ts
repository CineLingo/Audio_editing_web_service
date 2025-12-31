'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef<number | null>(null);

  const updateProgress = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      requestRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  useEffect(() => {
    audioRef.current = new Audio();
    const audio = audioRef.current;
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => {
      setIsPlaying(false);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      audio.playbackRate = 1.0;
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      audio.pause();
    };
  }, []);

  useEffect(() => {
    if (isPlaying) requestRef.current = requestAnimationFrame(updateProgress);
    else if (requestRef.current) cancelAnimationFrame(requestRef.current);
  }, [isPlaying, updateProgress]);

  const loadAudio = useCallback((url: string) => {
    if (audioRef.current) {
      // 소스가 바뀌면 항상 "정지 + 처음"으로 리셋
      // (히스토리 이동/편집 결과 로드 시 UI가 '전체 재생'으로 돌아가야 함)
      try {
        audioRef.current.pause();
      } catch {
        // ignore
      }
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      audioRef.current.playbackRate = 1.0;
      try {
        audioRef.current.currentTime = 0;
      } catch {
        // some browsers may throw if metadata not loaded yet
      }
      setIsPlaying(false);
      setCurrentTime(0);

      audioRef.current.src = url;
      audioRef.current.load();
    }
  }, []);

  const playAll = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = 1.0;
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const playSegment = useCallback((start: number, end: number, delta: number) => {
    if (!audioRef.current) return;
    
    const originalDuration = end - start;
    const targetDuration = Math.max(0.1, originalDuration + delta);
    const rate = originalDuration / targetDuration;

    // 배속 적용
    audioRef.current.playbackRate = rate;
    audioRef.current.currentTime = start;
    audioRef.current.play();
    setIsPlaying(true);

    const checkEnd = () => {
      if (audioRef.current && audioRef.current.currentTime >= end) {
        audioRef.current.pause();
        audioRef.current.playbackRate = 1.0;
        setIsPlaying(false);
      } else if (audioRef.current && !audioRef.current.paused) {
        requestAnimationFrame(checkEnd);
      }
    };
    requestAnimationFrame(checkEnd);
  }, []);

  return { isPlaying, currentTime, duration, loadAudio, playAll, playSegment, pause, seek };
}