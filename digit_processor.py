import cv2
for i in range(1,10):
    img = cv2.imread(f'digits_raw/{i}_2.png', cv2.IMREAD_GRAYSCALE)
    img = cv2.resize(img, (50, 50))
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    img = cv2.erode(img, kernel, iterations=1)
    img = img[10:40, 10:40]
    img = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY)[1]
    cv2.imwrite(f'digits/{i}_2.png', img)