import cv2
import mediapipe as mp
import numpy as np
import os

# 제스처와 라벨 매핑
gestures = {
    0: 'volume_up', 
    1: 'volume_down', 
    2: 'mute', 
    3: 'camera_toggle', 
    4: 'exit_room', 
    5: 'cursor', 
    6: 'grab', 
    7: 'resize', 
    8: 'draw_mode'
}
gesture_labels = {v: k for k, v in gestures.items()}

# MediaPipe Hands 초기화
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
hands = mp_hands.Hands(
    max_num_hands=2,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5)

DATA_PATH = './data'
if not os.path.exists(DATA_PATH):
    os.makedirs(DATA_PATH)

cap = cv2.VideoCapture(0)

# 데이터 수집을 위한 변수
current_gesture = -1
collecting = False
data_points = []

print("데이터 수집 스크립트 시작.")
print("수집할 제스처를 선택하세요:")
for k, v in gestures.items():
    print(f"'{k}' 키: {v}")
print("'q' 키: 종료")

while cap.isOpened():
    success, image = cap.read()
    if not success:
        continue

    image = cv2.cvtColor(cv2.flip(image, 1), cv2.COLOR_BGR2RGB)
    results = hands.process(image)
    image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

    key = cv2.waitKey(1)

    if key & 0xFF == ord('q'):
        break
    elif key != -1 and chr(key).isdigit() and int(chr(key)) in gestures:
        current_gesture = int(chr(key))
        collecting = True
        data_points = []
        print(f"'{gestures[current_gesture]}' 제스처 데이터 수집 시작...")

    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            mp_drawing.draw_landmarks(image, hand_landmarks, mp_hands.HAND_CONNECTIONS)

            if collecting:
                landmarks = np.array([[lm.x, lm.y, lm.z] for lm in hand_landmarks.landmark]).flatten()
                data_points.append(landmarks)
                
                cv2.putText(image, f"Collecting {gestures[current_gesture]}: {len(data_points)}", 
                            (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

    if collecting and len(data_points) >= 2000:
        file_path = os.path.join(DATA_PATH, f'{gestures[current_gesture]}.npy')
        np.save(file_path, np.array(data_points))
        print(f"'{gestures[current_gesture]}' 데이터 저장 완료. ({file_path})")
        collecting = False
        current_gesture = -1

    cv2.imshow('Data Collection', image)

cap.release()
cv2.destroyAllWindows()
