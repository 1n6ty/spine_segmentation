import pathlib

def init():
    HOME: pathlib.Path = pathlib.Path.home()

    dicom_path: pathlib.Path = HOME / 'media/private/dicom_files'
    dicom_path.mkdir(parents=True, exist_ok=True)
