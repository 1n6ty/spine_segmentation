import numpy as np
import cv2
import os, pydicom
from pathlib import Path
from scipy.spatial import KDTree

SPINE_MODEL = str(Path(__file__).resolve().parent / "side-exp/train4/weights/best.pt")

test_files = [
    (str(Path(__file__).resolve().parent.parent / f'Data/spine-segmentation/dicom/{i}'), str(Path(__file__).resolve().parent.parent / f'Data/spine-segmentation/points/{i.split('.')[0] + '.png'}')) for i in os.listdir(Path(__file__).resolve().parent.parent / 'Data/spine-segmentation/dicom') if i.endswith('dcm')
][:2]

from segmentation.compose import segment_spine_from_S1_to_C2

from multiprocessing import Pool

def process_single_file(file_pair):
    """
    Функция-воркер для обработки одного файла.
    Принимает кортеж (dcm_path, png_path).
    """
    dcm, png = file_pair
    try:
        # 1. Загрузка данных
        points_img = cv2.cvtColor(cv2.imread(png), cv2.COLOR_BGR2GRAY)
        true_points = np.argwhere(points_img)[:, ::-1]
        
        ds = pydicom.dcmread(dcm)
        img = ds.pixel_array

        # 2. Сегментация (предполагаем, что модель и функция доступны)
        vertebraes = segment_spine_from_S1_to_C2(img, SPINE_MODEL)
        ref_points = np.concatenate([v.reference_points for v in vertebraes])

        if len(true_points) > 0 and len(ref_points) > 0:
            tree = KDTree(true_points)
            distances, _ = tree.query(ref_points)
            
            # Применяем ваш срез
            processed_dist = distances[4:-3]
            return processed_dist.tolist() # Возвращаем список для удобства накопления
        else:
            return []
    except Exception as e:
        print(f"Ошибка при обработке {dcm}: {e}")
        return []

if __name__ == "__main__":
    all_distances_flat = []

    # Количество процессов (обычно равно количеству ядер CPU)
    num_processors = 2

    print(f"Запуск параллельной обработки {len(test_files)} файлов...")

    with Pool(processes=num_processors) as pool:
        # imap_unordered возвращает итератор
        for result in pool.imap_unordered(process_single_file, test_files):
            if result:
                all_distances_flat.extend(result)

    # --- Итоговые расчеты ---
    all_dist = np.array(all_distances_flat)

    def print_stats(data, label):
        if len(data) == 0:
            print(f"{label}: Нет данных")
            return
        print(f"\n--- {label} ---")
        print(f"Mean:   {np.mean(data):.6f}")
        print(f"Median: {np.median(data):.6f}")
        print(f"Min:    {np.min(data):.6f}")
        print(f"Max:    {np.max(data):.6f}")
        print(f"Count:  {len(data)}")

    print_stats(all_dist, "ОБЩАЯ СТАТИСТИКА")

    for i in range(4):
        subset = all_dist[i::4]
        print_stats(subset, f"ГРУППА ИНДЕКСОВ {i} (шаг 4)")