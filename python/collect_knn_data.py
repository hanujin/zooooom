#!/usr/bin/env python3
"""
Collect landmark vectors for 9 hand-gestures with MediaPipe + OpenCV.
Press a number key 0-8 to start recording 1 000 frames for that gesture.
The 63-D (21 × xyz) vectors are saved under ./data/<label>.npy
─────────────────────────────────────────────────────────────────────────
Keys & labels:
  0 volume_up      1 volume_down   2 mute
  3 cam_toggle     4 exit_room     5 cursor_grab
  6 resize         7 draw_mode     8 extra_future
"""
import cv2, os, numpy as np
import mediapipe as mp

CAPTURE_FRAMES = 1_000                 # per gesture
OUT_DIR        = "./data"
os.makedirs(OUT_DIR, exist_ok=True)

LABELS = [
    "volume_up", "volume_down", "mute",
    "cam_toggle", "exit_room", "cursor",
    "grab", "draw_mode"
]

mp_hands = mp.solutions.hands.Hands(
    static_image_mode=False, max_num_hands=1,
    min_detection_confidence=0.5, min_tracking_confidence=0.5
)
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    raise RuntimeError("Web-cam not accessible")

def normalise(lm):
    """ centre on wrist (LM-0) and scale by distance wrist→middle-MCP (LM-9) """
    pts   = lm.reshape(21, 3)
    pts  -= pts[0]                          # translation
    span  = np.linalg.norm(pts[9])
    return (pts / max(span, 1e-5)).flatten()

data_buf = {lbl: [] for lbl in LABELS}
current  = None
frames   = 0

print("[SPACE] show help, [ESC] quit.")
while True:
    ret, frame = cap.read()
    if not ret: break
    frame = cv2.flip(frame, 1)
    rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    res   = mp_hands.process(rgb)

    if res.multi_hand_landmarks:
        lm  = res.multi_hand_landmarks[0]
        vec = np.array([[p.x, p.y, p.z] for p in lm.landmark]).flatten()
        vec = normalise(vec)

        if current is not None and frames < CAPTURE_FRAMES:
            data_buf[current].append(vec)
            frames += 1
            cv2.putText(frame, f"REC {current} {frames}/{CAPTURE_FRAMES}",
                        (10,30), cv2.FONT_HERSHEY_SIMPLEX, 1,(0,0,255),2)
        elif frames >= CAPTURE_FRAMES:
            print(f"✔ finished {current}")
            current, frames = None, 0

    cv2.imshow("collect", frame)
    key = cv2.waitKey(1) & 0xFF
    if key == 27:  # ESC
        break
    if key == ord(' '):
        print("Press [0-8] to record gesture, ESC to quit.")
    if 48 <= key <= 55:                      # '0'-'8'
        idx = key - 48
        current = LABELS[idx]
        frames  = 0
        print(f"▶ recording {current}")

cap.release(); cv2.destroyAllWindows()

# ---------- save ----------
for lbl, vecs in data_buf.items():
    if vecs:
        arr = np.array(vecs, dtype=np.float32)
        path = os.path.join(OUT_DIR, f"{lbl}.npy")
        if os.path.exists(path):
            # append to existing samples
            old = np.load(path); arr = np.vstack([old, arr])
        np.save(path, arr)
        print(f"saved {lbl}: {arr.shape}")
print("All done!")
