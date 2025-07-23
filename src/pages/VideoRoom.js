import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import apiClient from '../api/index';
import { API_BASE } from '../config';
import { HandLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import '../styles/VideoRoom.css';

/**
 * Simplified version using your Prisma model:
 *  - Fetch room via GET /rooms/by-code/:code
 *  - Room object already includes ownerUserId
 *  - No /auth/me call anymore.
 *
 * We infer current user id by decoding the JWT locally (if present), or by
 * an "isOwner" flag passed in router state/query when you create/join.
 */

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
  const handLandmarkerRef = useRef(null);
  const rafIdRef = useRef(null);
  ///
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);

  const myUserId = decodeUserIdFromToken();
  // Optionally can be provided by previous page: navigate('/room/xxx', {state:{isOwner:true}})
  const roleFromState = location.state?.role;
  const passwordFromState = location.state?.password;
  const [iAmOwner, setIAmOwner] = useState(false);

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
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
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

        {drawMode && <canvas ref={canvasRef} className="draw-layer" />}
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
    </div>
  );
};

export default VideoRoom;