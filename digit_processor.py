import cv2
for i in range(10):
    img = cv2.imread(f'digits_raw/{i}.png', cv2.IMREAD_GRAYSCALE)
    img = cv2.resize(img, (50, 50))
    img = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY)[1]
    cv2.imwrite(f'digits/{i}.png', img)