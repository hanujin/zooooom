import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import apiClient from '../api/index';
import { API_BASE } from '../config';
import { HandLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import '../styles/VideoRoom.css';

// Mediapipe hand skeleton pairs
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17]
];

function normalise63(flat63) {
  // flat63: Float32Array length 63 (x0,y0,z0,...)
  const pts = new Float32Array(63);
  pts.set(flat63);

  // center on wrist (0)
  const wx = pts[0], wy = pts[1], wz = pts[2];
  for (let i = 0; i < 63; i += 3) {
    pts[i]   -= wx;
    pts[i+1] -= wy;
    pts[i+2] -= wz;
  }

  // scale by |LM0 -> LM9|
  const dx = pts[9*3 + 0], dy = pts[9*3 + 1], dz = pts[9*3 + 2];
  const span = Math.hypot(dx, dy, dz) || 1e-5;
  for (let i = 0; i < 63; i++) pts[i] /= span;

  return pts;
}


// simple KNN (brute-force) – fine for a few k-thousand vectors
function knnPredict(vec, model, k = model.k) {
  const { X, y, labels } = model;
  // compute squared L2
  const dists = [];
  for (let i = 0; i < X.length; i++) {
    let sum = 0;
    const row = X[i];
    for (let j = 0; j < 63; j++) {
      const diff = vec[j] - row[j];
      sum += diff * diff;
    }
    dists.push({ d: sum, label: y[i] });
  }
  dists.sort((a, b) => a.d - b.d);
  const votes = {};
  for (let i = 0; i < k; i++) {
    const lbl = dists[i].label;
    votes[lbl] = (votes[lbl] || 0) + 1;
  }
  let best = -1, bestCnt = -1;
  for (const [lbl, cnt] of Object.entries(votes)) {
    if (cnt > bestCnt) { bestCnt = cnt; best = +lbl; }
  }
  return labels[best];
}

function decodeUserIdFromToken() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Adjust according to how you sign JWT ("sub" or "id")
    return payload.sub || payload.id || payload.userId || null;
  } catch (_) {
    return null;
  }
}

const VideoRoom = () => {
  const { meetingCode } = useParams(); // route: /rooms/:code
  const navigate = useNavigate();
  const location = useLocation();

  const [room, setRoom] = useState(null); // Room from backend
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showCamera, setShowCamera] = useState(true);
  const [muted, setMuted] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [showLandmarks, setShowLandmarks] = useState(false);

  // const localVideoRef = useRef(null);
  // const remoteVideoRef = useRef(null);
  const ownerVideoRef = useRef(null);
  const participantVideoRef = useRef(null);
  const canvasRef = useRef(null);
  //// Hand landmarks
  const handsCanvasRef = useRef(null);
  const drawLandmarkerRef = useRef(null);
  const drawRafRef = useRef(null);
  const holdRef = useRef({ pred: null, since: 0, fired: false });

  // CLASSIFY pipeline
  const clsInitRef = useRef(false);
  const clsLandmarkerRef = useRef(null);
  const clsRafRef = useRef(null);

  const knnModelRef = useRef(null);
  const currentGestureRef = useRef(null);
  const stableSinceRef = useRef(0);
  const [gestureLabel, setGestureLabel] = useState(null);  // to show on UI
  ///
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);

  const myUserId = decodeUserIdFromToken();
  // Optionally can be provided by previous page: navigate('/room/xxx', {state:{isOwner:true}})
  const roleFromState = location.state?.role;
  const passwordFromState = location.state?.password;
  const [iAmOwner, setIAmOwner] = useState(false);

  //PEN
  const penCtxRef   = useRef(null);
  const lastTipRef  = useRef(null);
  const penRafRef = useRef(0);

  const changeVolume = (delta) => {
    const vid = iAmOwner ? participantVideoRef.current : ownerVideoRef.current;
    if (!vid) return;
    vid.volume = Math.min(1, Math.max(0, vid.volume + delta));
  };


  const triggerAction = (label) => {
    switch (label) {
      case 'volume_up':
        // increase volume of remote video (example)
        changeVolume(+0.1);
        break;
      case 'volume_down':
        changeVolume(-0.1);
        break;
      case 'mute':
        toggleMute(); // you already have this
        break;
      case 'cam_toggle':
        toggleCamera();
        break;
      case 'exit_room':
        leaveRoom();
        break;
      case 'cursor':
        // TODO: later
        break;
      case 'grab':
        // TODO
        break;
      case 'draw_mode':
        setDrawMode(v => !v);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    (async () => {
      try {
        // 1) Fetch room
        const { data: roomData } = await apiClient.get(`/rooms/by-code/${meetingCode}`);
        setRoom(roomData);

        const iam = (roomData.ownerUserId && myUserId && roomData.ownerUserId === myUserId)
                || roleFromState === 'owner';
        setIAmOwner(iam);

        // 2) Get media
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        (iam ? ownerVideoRef : participantVideoRef).current.srcObject = stream;

        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        const roomId = roomData.id;          // <— reuse everywhere
        let madeOffer = false;  
        
        // 3) Socket
        const socket = io(`${API_BASE}/signal`, {
          transports: ['websocket'],
          auth: { token: localStorage.getItem('token') },
        });
        socket.on('connect', () => {
          console.log('[WS] connected', socket.id);
          socket.emit('join_room', {
            roomIdOrCode: meetingCode,
            password: passwordFromState,
          });
        });
        socket.on('connect_error', (err) => console.error('[WS] connect_error', err));
        socket.on('error', (err) => console.error('[WS] error', err));
        socketRef.current = socket;

        // 4) PeerConnection

        pcRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        pc.ontrack = (e) => {
          console.log('[RTC] ontrack', e.streams[0]);
          const remoteStream = e.streams[0];
          if (iam) participantVideoRef.current.srcObject = remoteStream;
          else     ownerVideoRef.current.srcObject = remoteStream;
        };

        socket.on('ready', async ({ makeOffer }) => {
          if (makeOffer && !madeOffer) {
            madeOffer = true;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('offer', { roomId, description: pc.localDescription });
          }
        });

        // socket.on('peer_joined', async ({ userId }) => {
        //   console.log('[SIG] peer_joined', userId);
        //   if (!madeOffer) {
        //     madeOffer = true;
        //     const offer = await pc.createOffer();
        //     await pc.setLocalDescription(offer);
        //     socket.emit('offer', { roomId, description: pc.localDescription });
        //   }
        // });

        socket.on('offer', async (payload) => {
          console.log('[WS<-] offer', payload);
          const desc = payload?.description ?? payload; // accept both shapes
          if (!desc || !desc.type || !desc.sdp) {
            console.error('Bad offer payload', payload);
            return;
          }
          await pc.setRemoteDescription(new RTCSessionDescription(desc));

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('answer', { roomId, description: pc.localDescription });
        });

        socket.on('answer', async (payload) => {
          console.log('[WS<-] answer', payload, 'state=', pc.signalingState);
          if (pc.signalingState !== 'have-local-offer') {
            console.warn('[RTC] Ignoring answer, wrong state:', pc.signalingState);
            return;
          }
          const desc = payload?.description ?? payload;
          if (!desc?.type || !desc?.sdp) {
            console.error('Bad answer payload', payload);
            return;
          }
          await pc.setRemoteDescription(new RTCSessionDescription(desc));
        });

        pc.onicecandidate = e => {
          if (e.candidate) {
            socket.emit('ice_candidate', { roomId, candidate: e.candidate });
          }
        };

        socket.on('ice_candidate', async ({ candidate }) => {
         try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
         catch (e) { console.error('[RTC] addIceCandidate failed', e); }
        });

        // chat
        socket.on('chat_message', (msg) => setMessages((prev) => [...prev, msg]));

        socket.on('close_room', () => {
          alert('Room closed');
          navigate('/');
        });
      } catch (err) {
        console.error(err);
        alert('Failed to join room');
        navigate('/');
      }
    })();

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (pcRef.current) pcRef.current.close();
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [meetingCode, navigate]);

  useEffect(() => {
    (async () => {
      const res = await fetch('/models/knn_model.json');
      const model = await res.json();
      // convert nested arrays to Float32Array for faster math
      model.X = model.X.map(row => Float32Array.from(row));
      model.y = Int16Array.from(model.y);
      knnModelRef.current = model;
      console.log('[KNN] model loaded', model.labels);
    })();
  }, []);

  //-------- CLASSIFIERLOOP ------
  useEffect(() => {
    let run = true;
    let rafId = 0;

    function pickReadyVideo() {
        const cand = [
        ownerVideoRef.current,
        participantVideoRef.current,
      ].filter(v => v && v.readyState >= 2 && v.videoWidth > 0);
      return cand[0] || null;
    }

    (async () => {
      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      clsLandmarkerRef.current = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        },
        numHands: 1,
        runningMode: "VIDEO",
      });

      const tick = () => {
        if (!run) return;
        rafId = requestAnimationFrame(tick);

        const videoEl = pickReadyVideo();
        if (!videoEl) {
          return;
        }
        if (videoEl.paused) {
          videoEl.play().catch(()=>{});
        }
        const ts = performance.now();
        const res = clsLandmarkerRef.current.detectForVideo(videoEl, ts);
        if (res?.landmarks?.length) {
          const lm = res.landmarks[0];
          const lm63 = new Float32Array(63);
          for (let i = 0; i < 21; i++) {
            const p = lm[i];
            // mirror horizontally like your Python code (cv2.flip(frame,1))
            lm63[i*3]   = 1 - p.x;
            lm63[i*3+1] = p.y;
            lm63[i*3+2] = p.z;
          }
          const norm = normalise63(lm63);

          const model = knnModelRef.current;
          if (model) {
            const pred = knnPredict(norm, model);
            const now  = performance.now();
            const hold = holdRef.current;

            if (pred !== hold.pred) {
              hold.pred  = pred;
              hold.since = now;
              hold.fired = false;
            } else if (!hold.fired && now - hold.since >= 1000) { // 1 second
              setGestureLabel(pred);
              triggerAction(pred);
              hold.fired = true;   // don't spam while still holding
            }
          }
        } else { console.log('[CLS] no hand'); }
      };
      tick();
    })();

    return () => {
      run = false;
      cancelAnimationFrame(rafId);
    };
  }, []);

  /// // ----------------- VIDEO CANVAS SETUP -----------
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    cvs.width  = window.innerWidth;
    cvs.height = window.innerHeight;
    penCtxRef.current = cvs.getContext('2d');

    if (!drawMode) {
      // leaving draw mode -> stop stroke, clear last point
      lastTipRef.current = null;
    }
  }, [drawMode]);

  // ----------------- DRAW LOOP (only when showLandmarks) ----------
  useEffect(() => {
    // tear down
    if (!showLandmarks) {
      if (drawRafRef.current) cancelAnimationFrame(drawRafRef.current);
      const ctx = handsCanvasRef.current?.getContext('2d');
      if (ctx && handsCanvasRef.current) {
        ctx.clearRect(0, 0, handsCanvasRef.current.width, handsCanvasRef.current.height);
      }
      return;
    }

    let run = true;
    (async () => {
      if (!drawLandmarkerRef.current) {
        const fileset = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        drawLandmarkerRef.current = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          },
          numHands: 1,
          runningMode: "VIDEO",
        });
      }

      const videoEl = iAmOwner ? ownerVideoRef.current : participantVideoRef.current;
      const canvasEl = handsCanvasRef.current;
      const ctx = canvasEl.getContext('2d');

      const resizeCanvas = () => {
        canvasEl.width = window.innerWidth;
        canvasEl.height = window.innerHeight;
      };
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      const loop = () => {
        if (!run) return;
        const ts = performance.now();
        const res = drawLandmarkerRef.current.detectForVideo(videoEl, ts);

        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        if (res?.landmarks?.length) {
          const lmList = res.landmarks[0];
          const penCvs = canvasRef.current;
          if (!penCvs) { run = false; return; }   // canvas gone, stop loop
          const w = penCvs.width, h = penCvs.height;
          const pts = lmList.map(p => ({
            x: p.x * w,
            y: p.y * h,
          }));
          // --- PEN DRAW ---
          if (drawMode) {
            const penCtx = penCtxRef.current;
            if (penCtx) {
              const tip = pts[8]; // index fingertip
              if (lastTipRef.current) {
                penCtx.strokeStyle = 'cyan';
                penCtx.lineWidth   = 4;
                penCtx.lineCap     = 'round';
                penCtx.beginPath();
                penCtx.moveTo(lastTipRef.current.x, lastTipRef.current.y);
                penCtx.lineTo(tip.x, tip.y);
                penCtx.stroke();
              }
              lastTipRef.current = tip;
            }
          } else {
            lastTipRef.current = null;
          }
          // --- END PEN DRAW ---
          ctx.fillStyle = 'white';
          pts.forEach(pt => { ctx.beginPath(); ctx.arc(pt.x, pt.y, 5, 0, Math.PI*2); ctx.fill(); });
          ctx.strokeStyle = 'cyan';
          ctx.lineWidth = 2;
          for (const [a,b] of HAND_CONNECTIONS) {
            ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke();
          }
        }
        drawRafRef.current = requestAnimationFrame(loop);
      };
      loop();

      return () => {
        run = false;
        window.removeEventListener('resize', resizeCanvas);
        if (drawRafRef.current) cancelAnimationFrame(drawRafRef.current);
      };
    })();
  }, [showLandmarks, iAmOwner]);

  // -------- handlers ---------
  const sendChat = () => {
    if (!chatInput.trim() || !room) return;
    const msg = { text: chatInput, userId: myUserId, ts: Date.now() };
    socketRef.current.emit('chat_message', { roomId: room.id, ...msg });
    setMessages((prev) => [...prev, msg]);
    setChatInput('');
  };

  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setShowCamera(track.enabled);
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    const next = !track.enabled
    track.enabled = next;
    setMuted(!next);
  };

  const leaveRoom = async () => {
  try {
    if (iAmOwner && room) {
      // soft delete / close
      await apiClient.delete(`/rooms/${room.id}`);   // adjust path if different
      socketRef.current?.emit('close_room', { roomId: room.id });
    } else {
      socketRef.current?.emit('leave', { roomId: room?.id });
    }
  } catch (e) {
    console.error('delete/leave failed', e?.response?.data || e);
  } finally {
    navigate('/main'); // <-- your real main page route
  }
};

  return (
    <div className="room-root">
      <div className="video-area">
        {/* Left: owner always */}
        <div className="video-slot left-slot">
          <video
            ref={ownerVideoRef}
            autoPlay playsInline muted
            className="video-feed"
          />
          <div className="name-tag">Owner</div>
        </div>

        {/* Right: participant */}
        <div className="video-slot right-slot">
          <video
            ref={participantVideoRef}
            autoPlay playsInline
            className="video-feed"
            muted={iAmOwner ? false : true}
          />
          <div className="name-tag">Participant</div>
        </div>

         <canvas ref={canvasRef} className="draw-layer" style={{pointerEvents:'none'}} />
      </div>

      <aside className="chat-panel">
        <div className="chat-messages">
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.userId === myUserId ? 'me' : ''}`}>
              <span className="who">{m.userId === myUserId ? 'Me' : 'Peer'}</span>
              <span className="text">{m.text}</span>
            </div>
          ))}
        </div>
        <div className="chat-input-row">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
          />
          <button onClick={sendChat}>Send</button>
        </div>
      </aside>

      <div className="sticker-bar">
        <div className="sticker-placeholder">🧸 Stickers area (TODO)</div>
      </div>

      <div className="control-bar">
        <button onClick={toggleCamera} title="Toggle Camera">{showCamera ? '📷' : '🚫📷'}</button>
        <button onClick={toggleMute} title="Toggle Mute">{muted ? '🔇' : '🎤'}</button>
        <button onClick={() => setDrawMode((v) => !v)} title="Draw Mode">✏️</button>
        <button onClick={() => setShowLandmarks((v) => !v)} title="Show Landmarks">🖐️</button>
        <button className="leave-btn" onClick={leaveRoom}>나가기</button>
      </div>
      {showLandmarks && <canvas ref={handsCanvasRef} id="hands-overlay" />}
      <div className="gesture-label">{gestureLabel ?? ''}</div>
    </div>
  );
};

export default VideoRoom;