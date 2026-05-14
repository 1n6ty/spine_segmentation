import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score

# 1. Load the dataset
df = pd.read_csv('lesions_with_points.csv')
df_filtered = df
# 2. Filter values below the median for each lesion_type
# FIXED: Added include_groups=False to silence the FutureWarning
# df_filtered = df.groupby('lesion_type', group_keys=False).apply(
#     lambda x: x[x['dist'] <= x['dist'].median() * 1.25],
#     include_groups=False 
# ).reset_index(drop=True)

# # Re-adding the lesion_type column if include_groups=False dropped it unexpectedly 
# # OR just ensure we select features correctly.
# # A safer way to filter without warnings:
# df_filtered = df[df['dist'] <= df.groupby('lesion_type')['dist'].transform('median') * 1.25]

print(f"Original samples: {len(df)}")
print(f"Filtered samples: {len(df_filtered)}")

# 3. Define features and target
X = df_filtered.drop(['lesion_type', 'dist'], axis=1)
y = df_filtered['lesion_type']

# 4. Split the data
X_train, X_val, y_train, y_val = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# 5. Scaling
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_val_scaled = scaler.transform(X_val)

# 6. Training/Evaluation Function
# FIXED: Removed the extra argument that caused the "Series" error
def run_model(model, train_x, val_x, train_y, val_y, name):
    model.fit(train_x, train_y)
    preds = model.predict(val_x)
    print(f"--- {name} Results ---")
    print(f"Accuracy: {accuracy_score(val_y, preds):.4f}")
    # zero_division=0 hides warnings when a class has no predictions
    print(classification_report(val_y, preds, zero_division=0))

# 7. Initialize and Run
knn = KNeighborsClassifier(n_neighbors=3)
rf = RandomForestClassifier(n_estimators=1000, random_state=42)

run_model(knn, X_train_scaled, X_val_scaled, y_train, y_val, "KNN")
run_model(rf, X_train, X_val, y_train, y_val, "Random Forest")