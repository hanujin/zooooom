import os
import numpy as np
from sklearn.model_selection import train_test_split
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout, BatchNormalization
from tensorflow.keras.utils import to_categorical

# 데이터 및 모델 경로 설정
DATA_PATH = './data'
MODEL_PATH = './model'
if not os.path.exists(MODEL_PATH):
    os.makedirs(MODEL_PATH)

# 제스처 데이터 불러오기
X_data = []
y_data = []
actions = []

num_classes = 0

# 파일 목록을 정렬하여 항상 동일한 순서를 보장
file_list = sorted(os.listdir(DATA_PATH))

for file_name in file_list:
    if not file_name.endswith('.npy'):
        continue
    
    action = file_name.split('.')[0]
    
    actions.append(action)
    
    data = np.load(os.path.join(DATA_PATH, file_name))
    X_data.append(data)
    
    # 각 데이터 포인트에 라벨(제스처 인덱스) 할당
    label_index = len(actions) - 1
    y_data.append(np.full(data.shape[0], label_index))

print(f"수집된 제스처: {actions}")
num_classes = len(actions)

X_data = np.concatenate(X_data, axis=0)
y_data = np.concatenate(y_data, axis=0).astype(int)

# 데이터셋 분리
X_train, X_test, y_train, y_test = train_test_split(
    X_data, y_data, test_size=0.2, random_state=42, stratify=y_data
)

# 라벨을 원-핫 인코딩으로 변환
y_train_categorical = to_categorical(y_train, num_classes=len(actions))
y_test_categorical = to_categorical(y_test, num_classes=len(actions))

# 모델 구성
model = Sequential([
    Dense(256, activation='relu', input_shape=(63,)),
    BatchNormalization(),
    Dropout(0.4),
    Dense(128, activation='relu'),
    BatchNormalization(),
    Dropout(0.3),
    Dense(64, activation='relu'),
    Dropout(0.2),
    Dense(num_classes, activation='softmax')
])

model.compile(
    optimizer=Adam(learning_rate=0.001),
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

print("\n모델 요약:")
model.summary()

# 모델 학습
print("\n모델 학습 시작...")
history = model.fit(
    X_train,
    y_train_categorical,
    epochs=50,
    batch_size=32,
    validation_data=(X_test, y_test_categorical),
    verbose=1
)

# 모델 평가
loss, accuracy = model.evaluate(X_test, y_test_categorical)
print(f"\n테스트 정확도: {accuracy * 100:.2f}%")

# 학습된 모델을 SavedModel 형식으로 내보내기(export)
model_export_path = os.path.join(MODEL_PATH, 'gesture_model_export')
model.export(model_export_path)
print(f"\n모델이 '{model_export_path}' 디렉토리에 SavedModel 형식으로 내보내졌습니다.")
