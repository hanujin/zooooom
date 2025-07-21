import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HandLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import * as tf from '@tensorflow/tfjs';
import './../styles/VideoRoom.css';

// ParticipantView는 원격 참가자용으로 유지합니다.
const ParticipantView = ({ name }) => {
  return (
    <div className="participant-view">
      <video autoPlay playsInline className="video-feed"></video>
      <div className="participant-name">{name}</div>
    </div>
  );
};

function VideoRoom() {
  const { meetingCode } = useParams();
  const navigate = useNavigate();
  const [roomInfo, setRoomInfo] = useState({ name: '테스트 채팅방' });
  const [participants, setParticipants] = useState([
    { id: 'remote1', name: '참가자 1' },
  ]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [handLandmarker, setHandLandmarker] = useState(null);
  const [gestureModel, setGestureModel] = useState(null);
  const [actions, setActions] = useState([]); // 학습된 제스처 이름 목록
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [volume, setVolume] = useState(1.0);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [isCursorVisible, setIsCursorVisible] = useState(false);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [stickerPosition, setStickerPosition] = useState({ x: 50, y: 50 });
  const [stickerSize, setStickerSize] = useState(50);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false); // 카메라 준비 상태 추가
  const [lines, setLines] = useState([]);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5);
  const [detectionResults, setDetectionResults] = useState(null);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [currentGestureText, setCurrentGestureText] = useState('제스처 없음');
  const lastGesture = useRef(null);
  const gestureTimeout = useRef(null);
  const exitTimeout = useRef(null);

  const toggleCamera = (status) => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getVideoTracks();
      if (tracks.length > 0) {
        tracks[0].enabled = status;
        setIsCameraOn(status);
      }
    }
  };

  const toggleMic = () => {
    setIsMicOn(prev => !prev);
  };

  const changeVolume = (amount) => {
    setVolume(prev => Math.max(0, Math.min(1, prev + amount)));
  };

  const handleLeaveRoom = () => {
    navigate('/main');
  };

  // 제스처 기반 그리기 로직 (모델 예측 사용)
  useEffect(() => {
    if (!isDrawingMode || !detectionResults || !detectionResults.landmarks || detectionResults.landmarks.length === 0) return;

    const currentGesture = currentGestureText;
    const landmarks = detectionResults.landmarks[0];
    const cursorX = landmarks[8].x * canvasRef.current.width;
    const cursorY = landmarks[8].y * canvasRef.current.height;

    if (currentGesture === 'grab') {
      if (!isPainting) {
        setLines(prevLines => [...prevLines, { points: [{ x: cursorX, y: cursorY }], color, lineWidth }]);
        setIsPainting(true);
      } else {
        setLines(prevLines => {
          const lastLine = prevLines[prevLines.length - 1];
          const newPoints = [...lastLine.points, { x: cursorX, y: cursorY }];
          const newLine = { ...lastLine, points: newPoints };
          return [...prevLines.slice(0, -1), newLine];
        });
      }
    } else {
      if (isPainting) {
        setIsPainting(false);
      }
    }
  }, [detectionResults, isDrawingMode, currentGestureText, color, lineWidth, isPainting]);

  const clearCanvas = () => {
    setLines([]);
  };

  // 제스처에 따른 액션 처리 (커서, 볼륨 등)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!detectionResults || !detectionResults.landmarks || detectionResults.landmarks.length === 0) {
      setIsCursorVisible(false);
      return;
    }

    const landmarks = detectionResults.landmarks[0];
    
    // 제스처별 액션 분기
    switch (currentGestureText) {
      case 'cursor':
        const cursorX = (1 - landmarks[8].x) * canvas.clientWidth;
        const cursorY = landmarks[8].y * canvas.clientHeight;
        setCursorPosition({ x: cursorX, y: cursorY });
        setIsCursorVisible(true);
        break;
      
      // TODO: 아래 제스처들에 대한 실제 액션 함수를 연결해야 합니다.
      case 'volume_up':
        // 예: changeVolume(0.1);
        console.log("Volume Up");
        setIsCursorVisible(false);
        break;
      
      case 'volume_down':
        // 예: changeVolume(-0.1);
        console.log("Volume Down");
        setIsCursorVisible(false);
        break;
        
      case 'mute':
        // 예: toggleMic();
        console.log("Mute");
        setIsCursorVisible(false);
        break;

      default:
        // 그 외 모든 제스처는 커서를 숨깁니다.
        setIsCursorVisible(false);
        break;
    }
    
  }, [currentGestureText, detectionResults]);

  // MediaPipe 및 제스처 모델 초기화
  useEffect(() => {
    const loadModels = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
        const newHandLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });
        setHandLandmarker(newHandLandmarker);
        console.log("Hand Landmarker 로드 완료.");

        console.log("TensorFlow.js 모델 로딩 시작...");
        const model = await tf.loadGraphModel('/tfjs_model/model.json'); // loadLayersModel -> loadGraphModel로 변경
        setGestureModel(model);
        console.log("TensorFlow.js 모델 로딩 성공.");
        
        // Python 학습 스크립트의 정렬된 순서와 동일하게 설정
        const actionList = ['camera_toggle', 'cursor', 'draw_mode', 'exit_room', 'grab', 'mute', 'resize', 'volume_down', 'volume_up'];
        setActions(actionList);
        console.log("학습된 제스처 목록:", actionList);

      } catch (error) {
        console.error("AI 모델 로딩 중 심각한 오류 발생:", error);
      }
    };
    loadModels();
  }, []);

  // 1. 웹캠 스트림 즉시 설정
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const enableWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.addEventListener('loadeddata', () => {
          setIsVideoReady(true);
          console.log("카메라 준비 완료.");
        });
      } catch (err) {
        console.error("Error accessing webcam: ", err);
      }
    };

    enableWebcam();

    return () => {
      if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 2. 모델 로드 및 카메라 준비 완료 후 제스처 감지 루프 시작
  useEffect(() => {
    if (!handLandmarker || !gestureModel || !isVideoReady) return;

    const video = videoRef.current;
    let animationFrameId;

    const predictWebcam = () => {
      if (video.readyState >= 2) {
        const results = handLandmarker.detectForVideo(video, Date.now());
        setDetectionResults(results);
        
        if (results.landmarks && results.landmarks.length > 0 && actions.length > 0) {
          try {
            const landmarks = results.landmarks[0].flatMap(lm => [lm.x, lm.y, lm.z]);
            const inputTensor = tf.tensor2d([landmarks]);
            
            const prediction = gestureModel.predict(inputTensor);
            const predictedIndex = prediction.argMax(1).dataSync()[0];
            const predictedGesture = actions[predictedIndex];
            
            // console.log("예측된 제스처:", predictedGesture); // 로그 추가
            setCurrentGestureText(predictedGesture);
            tf.dispose([inputTensor, prediction]);
          } catch (error) {
            console.error("제스처 예측 중 오류:", error);
          }
        } else {
          setCurrentGestureText('제스처 없음');
        }
      }
      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    console.log("제스처 예측 시작.");
    predictWebcam();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [handLandmarker, gestureModel, isVideoReady, actions]);

  // 캔버스 렌더링
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);

    lines.forEach(line => {
      context.strokeStyle = line.color;
      context.lineWidth = line.lineWidth;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      line.points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.stroke();
    });

    if (showLandmarks && detectionResults && detectionResults.landmarks) {
      const drawingUtils = new DrawingUtils(context);
      for (const landmarks of detectionResults.landmarks) {
        drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 5 });
        drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 2 });
      }
    }
  }, [lines, detectionResults, showLandmarks]);

  return (
    <div className="video-room-container">
      <header className="room-header">
        <h2>{roomInfo ? roomInfo.name : '로딩 중...'}</h2>
      </header>
      <div className="main-content-wrapper">
        <div className="video-grid-main">
          <div className="participant-view local">
            <video ref={videoRef} autoPlay playsInline muted className="video-feed"></video>
            <canvas ref={canvasRef} className="output_canvas"></canvas>
            <div className="gesture-display">{currentGestureText}</div>
            {isCursorVisible && <div className="cursor" style={{ left: `${cursorPosition.x}px`, top: `${cursorPosition.y}px` }}></div>}
            <div 
              className="sticker" 
              style={{ 
                left: `${stickerPosition.x}px`, 
                top: `${stickerPosition.y}px`,
                width: `${stickerSize}px`,
                height: `${stickerSize}px`,
                fontSize: `${stickerSize * 0.8}px`
              }}
            >🎨</div>
            <div className="participant-name">나</div>
          </div>
          {participants.map(p => (
            <ParticipantView key={p.id} name={p.name} />
          ))}
        </div>
        <div className="chat-panel">
        </div>
      </div>
      <div className="controls-bar">
        {/* Left-aligned controls (empty for now) */}
        <div className="control-group"></div>

        {/* Center-aligned controls */}
        <div className="control-group control-buttons">
          <button onClick={() => toggleCamera(!isCameraOn)} title={isCameraOn ? '카메라 끄기' : '카메라 켜기'}>
            {isCameraOn ? '📷' : '📸'}
          </button>
          <button onClick={toggleMic} title={isMicOn ? '마이크 끄기' : '마이크 켜기'}>
            {isMicOn ? '🎤' : '🔇'}
          </button>
          <button onClick={() => setIsDrawingMode(prev => !prev)} title={isDrawingMode ? '그리기 종료' : '그리기 시작'}>
            ✏️
          </button>
          <button onClick={() => setShowLandmarks(prev => !prev)} title={showLandmarks ? '관절 숨기기' : '관절 보이기'}>
            🖐️
          </button>
        </div>

        {/* Right-aligned controls */}
        <div className="control-group">
          <button className="leave-btn" onClick={handleLeaveRoom} title="나가기">🚪 나가기</button>
        </div>

        {/* Drawing tools palette */}
        {isDrawingMode && (
          <div className="drawing-controls">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="색상 선택" />
            <input type="range" min="1" max="20" value={lineWidth} onChange={(e) => setLineWidth(e.target.value)} title="선 굵기" />
            <button onClick={clearCanvas} title="전체 지우기">🗑️</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoRoom;
