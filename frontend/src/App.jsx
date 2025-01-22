import './App.css'
import VideoPlayer from './VideoPlayer'
import { useRef } from 'react'

function App() {
  const playerRef = useRef(null);
  const videoLink = "http://localhost:8000/uploads/videos/568997f7-ac80-4e02-95c1-98b0a703ad9d/h264_master.m3u8";
  
  const videoPlayerOptions = {
    controls: true,
    responsive: true,
    fluid: true,
    playbackRates: [0.5, 1, 1.5, 2],
    sources: [{
      src: videoLink,
      type: 'application/x-mpegURL'
    }],
  }

  const handlePlayerReady = (player) => {
    playerRef.current = player;

  };

  return (
    <>
      <div>
        <h1>Video Player</h1>
      </div>
      <VideoPlayer options={videoPlayerOptions} onReady={handlePlayerReady} />
    </>
  )
}

export default App;