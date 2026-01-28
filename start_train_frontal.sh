#!/bin/bash

#SBATCH --job-name=ss_frontal
#SBATCH --error=ss_frontal-%j.err
#SBATCH --output=ss_frontal-%j.log
#SBATCH --time=5-00:00:00
#SBATCH --ntasks=1
#SBATCH --nodes=1
#SBATCH --cpus-per-task=16
#SBATCH --mem=64G

export OMP_NUM_THREADS=16
export MKL_NUM_THREADS=16

srun --ntasks=1 .venv/bin/python3 train_frontal_yolo_v12.py  > training_frontal.log
