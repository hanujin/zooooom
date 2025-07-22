import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import './../styles/VideoRoom.css';

/* ──────────────────────────────────────────────────────────
   SIMPLE PLACE‑HOLDER COMPONENT FOR REMOTE PARTICIPANTS
   ────────────────────────────────────────────────────────── */
const ParticipantView = ({ name }) => (
  <div className="participant-view">
    <video autoPlay playsInline className="video-feed" />
    <div className="participant-name">{name}</div>
  </div>
);

/* ──────────────────────────────────────────────────────────
   LANDMARK NORMALISATION – same algo as train_knn.py
 ────────────────────────────────────────────────────────── */
function normalise(flat63) {
  // if (flat63.length !== 63) return flat63;
  const step = flat63.length === 63 ? 3 : 2;
  const pts = [];
  for (let i = 0; i < 21; i++) pts.push([flat63[step * i], flat63[step * i + 1], step === 3 ? flat63[step * i + 2] : 0]);
  const wrist = pts[0];
  pts.forEach((p) => {
    p[0] -= wrist[0];
    p[1] -= wrist[1];
    p[2] -= wrist[2];
  });
  const span = Math.hypot(pts[9][0], pts[9][1], pts[9][2]) || 1e-5;
  pts.forEach((p) => {
    p[0] /= span;
    p[1] /= span;
    p[2] /= span;
  });
  return Float32Array.from(pts.flat());
}

/* ──────────────────────────────────────────────────────────
   Vanilla K‑NN predictor factory
 ────────────────────────────────────────────────────────── */
function makeKnnPredict({ k, X, y, labels }) {
  return (sample) => {
    // k개만 유지
    const best = Array.from({ length: k }, () => [Infinity, -1]); // [dist, idx]

    for (let idx = 0; idx < X.length; idx++) {
      const ex = X[idx];
      let sum = 0;
      for (let j = 0; j < 63; j++) {
        const d = sample[j] - ex[j];
        sum += d * d;
      }
      const dist = Math.sqrt(sum);
      if (dist < best[k - 1][0]) {
        best[k - 1] = [dist, idx];
        best.sort((a, b) => a[0] - b[0]); // k가 작으니 이 정도 정렬은 OK
      }
    }

    const minDist = best[0][0];
    const THRESH = 4; // 일단 이 정도로. 필요하면 조절
    if (minDist > THRESH) return 'unknown';

    const votes = {};
    for (const [, idx] of best) {
      const lbl = labels[y[idx]];
      votes[lbl] = (votes[lbl] || 0) + 1;
    }
    return Object.entries(votes).reduce(
      (bestLbl, [lbl, v]) => (v > (votes[bestLbl] || 0) ? lbl : bestLbl),
      ''
    );
  };
}

/* prettier hand overlay */
const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];
function drawHand(ctx, lm, w, h) {
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,255,127,0.9)';
  ctx.fillStyle = 'rgba(0,255,127,1)';
  EDGES.forEach(([i, j]) => {
    ctx.beginPath();
    ctx.moveTo((1-lm[i].x) * w, lm[i].y * h);
    ctx.lineTo((1-lm[j].x) * w, lm[j].y * h);
    ctx.stroke();
  });
  for (const p of lm) {
    ctx.beginPath();
    ctx.arc((1-p.x) * w, p.y * h, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ──────────────────────────────────────────────────────────
   MAIN COMPONENT
 ────────────────────────────────────────────────────────── */
export default function VideoRoom() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const predictRef = useRef(null);

  const navigate = useNavigate();
  const { roomId } = useParams();

  const [participants] = useState([]);
  const [roomInfo] = useState({ name: `Room ${roomId || ''}` });

  /* UI states */
  const [currentGestureText, setCurrentGestureText] = useState('제스처 없음');
  const [isCursorVisible, setIsCursorVisible] = useState(false);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });

  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [showLandmarks, setShowLandmarks] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [color, setColor] = useState('#ff5722');
  const [lineWidth, setLineWidth] = useState(4);

  /* media helpers */
  const toggleCamera = useCallback((on) => {
    setIsCameraOn(on);
    const track = videoRef.current?.srcObject?.getVideoTracks?.()[0];
    if (track) track.enabled = on;
  }, []);

  const toggleMic = useCallback(() => {
    setIsMicOn((prev) => {
      const next = !prev;
      const track = videoRef.current?.srcObject?.getAudioTracks?.()[0];
      if (track) track.enabled = next;
      return next;
    });
  }, []);

  const handleLeaveRoom = useCallback(() => navigate('/'), [navigate]);

  const clearCanvas = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, []);

  /* load KNN */
  useEffect(() => {
    fetch('/models/knn_model.json')
      .then((r) => r.json())
      .then((data) => {
        data.X = data.X.map((v) => Float32Array.from(v));
        predictRef.current = makeKnnPredict(data);
      });
  }, []);

  /* init mediapipe */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm';
      const MODEL_PATH = process.env.PUBLIC_URL + '/models/hand_landmarker.task';
      const fs = await FilesetResolver.forVisionTasks(WASM_ROOT);
      const lm = await HandLandmarker.createFromOptions(fs, {
        baseOptions: { modelAssetPath: MODEL_PATH },
        numHands: 1,
        runningMode: 'VIDEO',
      });
      if (!cancelled) landmarkerRef.current = lm;
    })();
    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
    };
  }, []);

  /* webcam */
  useEffect(() => {
    let stream;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((s) => {
      stream = s;
      videoRef.current.srcObject = s;
    });
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  /* gesture actions */
  const applyGesture = useCallback(
    (g) => {
      switch (g) {
        case 'volume_up':
          videoRef.current.volume = Math.min(1, videoRef.current.volume + 0.1);
          break;
        case 'volume_down':
          videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1);
          break;
        case 'mute':
          toggleMic();
          break;
        case 'cam_toggle':
          toggleCamera(!isCameraOn);
          break;
        case 'exit_room':
          handleLeaveRoom();
          break;
        case 'cursor':
          setIsCursorVisible(true);
          setIsGrabbing(false);
          break;
        case 'grab':
          setIsCursorVisible(true);
          setIsGrabbing(true);
          break;
        case 'draw_mode':
          setIsDrawingMode((p) => !p);
          setIsCursorVisible(false);
          setIsGrabbing(false);
          break;
        default:
          break;
      }
    },
    [isCameraOn, toggleMic, toggleCamera, handleLeaveRoom]
  );

  /* main loop */
  useEffect(() => {
    if (!landmarkerRef.current || !predictRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    // 비디오 메타데이터 로드된 직후(landmarker 루프 시작 전에 한 번만)
    const vw = videoRef.current.videoWidth;
    const vh = videoRef.current.videoHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${vw}px`;
    canvas.style.height = `${vh}px`;
    canvas.width  = vw * dpr;
    canvas.height = vh * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const gestureHoldMs = 1000;
    let lastGesture = '';
    let holdStart = 0;
    let lastFinger = null;

    const loop = () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        requestAnimationFrame(loop);
        return;
      }

      const ts = performance.now();
      const res = landmarkerRef.current.detectForVideo(videoRef.current, ts);

      /* preserve existing drawing */
      if (!isDrawingMode) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      /* landmarks */
      if (showLandmarks && res.landmarks?.length) {
        // ctx.save();
        // ctx.translate(vw, 0);
        // ctx.scale(-1, 1);
        drawHand(ctx, res.landmarks[0], vw, vh);
        // ctx.restore();
      }

      if (!res.landmarks?.length) {
        setCurrentGestureText('손 미검출');
        requestAnimationFrame(loop);
        return;
      }

      /* mirror X for prediction */
      const vec = Float32Array.from(res.landmarks[0].flatMap((p) => [1 - p.x, p.y]));
      const gesture = predictRef.current(normalise(vec));

      if (gesture !== lastGesture) {
        lastGesture = gesture;
        holdStart = ts;
      }

      setCurrentGestureText(gesture === 'unknown' ? '알 수 없음' : gesture);

      if (ts - holdStart > gestureHoldMs && gesture !== 'unknown') {
        applyGesture(gesture);
      }

      /* cursor & drawing */
      const tip = res.landmarks[0][8];
      const cx = (1 - tip.x) * canvas.width;
      const cy = tip.y * canvas.height;
      setCursorPosition({ x: cx, y: cy });

      if (isDrawingMode) {
        if (lastFinger) {
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          ctx.moveTo(lastFinger.x, lastFinger.y);
          ctx.lineTo(cx, cy);
          ctx.stroke();
        }
        lastFinger = { x: cx, y: cy };
      } else {lastFinger = null;}

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, [showLandmarks, isDrawingMode, color, lineWidth, applyGesture]);

  /* ──────────────────────────────────────────────────────────
     JSX – layout unchanged
 ────────────────────────────────────────────────────────── */
  return (
    <div className="video-room-container">
      <canvas ref={canvasRef} className="overlay-canvas" />
      <header className="room-header">
        <h2>{roomInfo ? roomInfo.name : '로딩 중...'}</h2>
      </header>
      <div className="main-content-wrapper">
        <div className="video-grid-main">
          <div className="participant-view local">
            <video ref={videoRef} autoPlay playsInline muted className="video-feed" />
            <div className="gesture-display">{currentGestureText}</div>
            {isCursorVisible && (
              <div
                className={`cursor ${isGrabbing ? 'grabbing' : ''}`}
                style={{ left: `${cursorPosition.x}px`, top: `${cursorPosition.y}px` }}
              />
            )}
            <div className="participant-name">나</div>
          </div>
          {participants.map((p) => (
            <ParticipantView key={p.id} name={p.name} />
          ))}
        </div>
        <div className="chat-panel" />
      </div>
      <div className="controls-bar">
        <div className="control-group" />
        <div className="control-group control-buttons">
          <button onClick={() => toggleCamera(!isCameraOn)} title={isCameraOn ? '카메라 끄기' : '카메라 켜기'}>
            {isCameraOn ? '📷' : '📸'}
          </button>
          <button onClick={toggleMic} title={isMicOn ? '마이크 끄기' : '마이크 켜기'}>
            {isMicOn ? '🎤' : '🔇'}
          </button>
          <button onClick={() => setIsDrawingMode((p) => !p)} title={isDrawingMode ? '그리기 종료' : '그리기 시작'}>
            ✏️
          </button>
          <button onClick={() => setShowLandmarks((p) => !p)} title={showLandmarks ? '관절 숨기기' : '관절 보이기'}>
            🖐️
          </button>
        </div>
        <div className="control-group">
          <button className="leave-btn" onClick={handleLeaveRoom} title="나가기">
            🚪 나가기
          </button>
        </div>
        {isDrawingMode && (
          <div className="drawing-controls">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="색상 선택" />
            <input type="range" min="1" max="20" value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} title="선 굵기" />
            <button onClick={clearCanvas} title="전체 지우기">
              🗑️
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
