import numpy as np

def compute_errq_jac(t: np.ndarray[np.float32], tau: np.float32, l: np.ndarray[np.float32]):
    err = (l[1:] - np.array([t[0] + t[1] * i for i in l[:-1]]))
    return [
        -1 * np.sum(
            np.where(err >= 0, tau * 1, (tau - 1))
        ),
        -1 * np.sum(
            np.where(err >= 0, [tau * i for i in l[:-1]], [(tau - 1) * i for i in l[:-1]])
        )
    ]

def compute_errq(t: np.ndarray[np.float32], tau: np.float32, l: np.ndarray[np.float32]):
    err = (l[1:] - np.array([t[0] + t[1] * i for i in l[:-1]]))
    return np.sum(
        np.where(err >= 0, tau * err, (tau - 1) * err)
    )