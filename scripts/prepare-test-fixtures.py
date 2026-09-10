from pathlib import Path
import cv2
root=Path(__file__).resolve().parents[1]
(root/'work').mkdir(exist_ok=True)
image=cv2.imread(str(root/'backend/presets/atta_1kg.jpg'))
height=image.shape[0]
for number,part in enumerate((image[:height//2],image[height//2:]),1):
    cv2.imwrite(str(root/f'work/side-{number}.jpg'),part)
print('Created two package-side fixtures in work/.')
