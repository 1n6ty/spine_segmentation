import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

def train_lesion_models(file_path):
    # 1. Load the data
    df = pd.read_csv(file_path)
    print(f"Loaded {len(df)} rows.")

    # 2. Separate Features (X) and Target (y)
    # Features are x1...y4 and p1...p6 (first 14 columns)
    X = df.drop(columns=['lesion_type', 'dist'])
    y = df['lesion_type']

    # 3. Train/Test Split (80% training, 20% validation)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # 4. Scaling (Crucial for KNN)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # --- KNN Model ---
    print("\n--- Training K-Nearest Neighbors ---")
    knn = KNeighborsClassifier(n_neighbors=5)
    knn.fit(X_train_scaled, y_train)
    knn_preds = knn.predict(X_test_scaled)
    
    print(f"KNN Accuracy: {accuracy_score(y_test, knn_preds):.4f}")
    print(classification_report(y_test, knn_preds))

    # --- Random Forest Model ---
    print("\n--- Training Random Forest ---")
    rf = RandomForestClassifier(n_estimators=100, random_state=42)
    rf.fit(X_train, y_train) # RF can handle unscaled data too
    rf_preds = rf.predict(X_test)

    print(f"Random Forest Accuracy: {accuracy_score(y_test, rf_preds):.4f}")
    print(classification_report(y_test, rf_preds))

    # 5. Confusion Matrix for the better model (usually RF)
    print("\nConfusion Matrix (Random Forest):")
    print(confusion_matrix(y_test, rf_preds))

    return knn, rf, scaler

if __name__ == "__main__":
    knn_model, rf_model, data_scaler = train_lesion_models('lesions_with_points.csv')