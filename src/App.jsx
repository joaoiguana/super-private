import { useEffect, useRef, useState } from 'react'
import { album, tracks } from './tracks.js'
import './App.css'

const hasMediaSession = 'mediaSession' in navigator

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function App() {
  // A single <audio> element whose src is swapped imperatively. Keeping one
  // element (and calling play() directly inside the user's tap) is what lets
  // playback continue with the screen locked or the tab in the background.
  const audioRef = useRef(null)
  const currentRef = useRef(0)
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const track = tracks[current]

  function load(index) {
    const audio = audioRef.current
    currentRef.current = index
    audio.src = tracks[index].src
    setCurrent(index)
    setTime(0)
    setDuration(0)
  }

  function playTrack(index) {
    if (index !== currentRef.current) load(index)
    audioRef.current.play()
  }

  function toggle() {
    const audio = audioRef.current
    if (audio.paused) audio.play()
    else audio.pause()
  }

  function next() {
    const index = currentRef.current
    if (index < tracks.length - 1) playTrack(index + 1)
    else load(0)
  }

  function previous() {
    const audio = audioRef.current
    if (audio.currentTime > 3 || currentRef.current === 0) audio.currentTime = 0
    else playTrack(currentRef.current - 1)
  }

  function seek(seconds) {
    audioRef.current.currentTime = seconds
    setTime(seconds)
  }

  function updatePositionState() {
    const audio = audioRef.current
    if (!hasMediaSession || !Number.isFinite(audio.duration)) return
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        position: Math.min(audio.currentTime, audio.duration),
        playbackRate: audio.playbackRate,
      })
    } catch {
      // Some browsers reject position updates mid-load; safe to skip.
    }
  }

  useEffect(() => {
    audioRef.current.src = tracks[0].src
  }, [])

  // Lock screen / notification controls.
  useEffect(() => {
    if (!hasMediaSession) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: album.artist,
      album: album.title,
      artwork: [{ src: album.artwork, sizes: '1000x1000', type: 'image/jpeg' }],
    })
    const handlers = {
      play: () => audioRef.current.play(),
      pause: () => audioRef.current.pause(),
      previoustrack: previous,
      nexttrack: next,
      seekto: (details) => seek(details.seekTime),
      seekbackward: (details) => seek(Math.max(audioRef.current.currentTime - (details.seekOffset || 10), 0)),
      seekforward: (details) => seek(audioRef.current.currentTime + (details.seekOffset || 10)),
    }
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        // Action not supported on this browser.
      }
    }
  })

  return (
    <div className="page">
      <div className="backdrop" style={{ backgroundImage: `url(${album.artwork})` }} />

      <main>
        <img className="artwork" src={album.artwork} alt={`Capa de ${album.title}`} />

        <header>
          <p className="artist">{album.artist}</p>
          <h1>{album.title}</h1>
          <p className="subtitle">demos</p>
        </header>

        <section className="player" aria-label="Leitor">
          <p className="now-playing">
            <span className="number">{String(current + 1).padStart(2, '0')}</span>
            {track.title}
          </p>

          <input
            className="progress"
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={time}
            onChange={(e) => seek(Number(e.target.value))}
            style={{ '--fill': duration ? `${(time / duration) * 100}%` : '0%' }}
            aria-label="Posição"
          />
          <div className="times">
            <span>{formatTime(time)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          <div className="controls">
            <button type="button" onClick={previous} aria-label="Anterior">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
            </button>
            <button type="button" className="play" onClick={toggle} aria-label={playing ? 'Pausa' : 'Tocar'}>
              {playing ? (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>
              )}
            </button>
            <button type="button" onClick={next} aria-label="Seguinte">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
            </button>
          </div>
        </section>

        <ol className="tracklist">
          {tracks.map((t, i) => (
            <li key={t.src}>
              <button
                type="button"
                className={i === current ? 'active' : undefined}
                onClick={() => (i === current ? toggle() : playTrack(i))}
                aria-current={i === current ? 'true' : undefined}
              >
                <span className="number">
                  {i === current && playing ? <span className="eq" aria-hidden="true"><i /><i /><i /></span> : String(i + 1).padStart(2, '0')}
                </span>
                <span className="title">{t.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </main>

      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => {
          setPlaying(true)
          if (hasMediaSession) navigator.mediaSession.playbackState = 'playing'
        }}
        onPause={() => {
          setPlaying(false)
          if (hasMediaSession) navigator.mediaSession.playbackState = 'paused'
        }}
        onEnded={next}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration)
          updatePositionState()
        }}
        onSeeked={updatePositionState}
        onRateChange={updatePositionState}
      />
    </div>
  )
}

export default App
