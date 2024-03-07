let VIDEO_ELEM = document.getElementById("camera-feed");
let CANVAS_ELEM = document.getElementById("camera-canvas");
let PHOTO_ELEM = document.getElementById("camera-image-raw");
let PROCESSED_ELEM = document.getElementById("camera-canvas-processed");
let PROCESSED_IMAGE_ELEM = document.getElementById("camera-image-processed");
let BOUNDED_PROCESSED_ELEM = document.getElementById("canvas-bounded-processed");

let streaming = false;
let width;
let height;

function startup() {
    video = VIDEO_ELEM;
    canvas = CANVAS_ELEM;

    navigator.mediaDevices
        .getUserMedia({ video: true, audio: false })
        .then((stream) => {
            video.srcObject = stream;
            video.play();
        })
        .catch((err) => {
            console.error(`An error occurred: ${err}`);
        });

    video.addEventListener(
        "canplay",
        (ev) => {
            if (!streaming) {
                width = 600;
                height = Math.round(video.videoHeight / (video.videoWidth / width));

                if (isNaN(height)) {
                    height = Math.round(width / (4 / 3));
                }

                video.setAttribute("width", width);
                video.setAttribute("height", height);

                canvas.setAttribute("width", width);
                canvas.setAttribute("height", height);
                
                PHOTO_ELEM.setAttribute("width", width);
                PHOTO_ELEM.setAttribute("height", height);

                PROCESSED_ELEM.setAttribute("width", width);
                PROCESSED_ELEM.setAttribute("height", height);

                PROCESSED_IMAGE_ELEM.setAttribute("width", width);
                PROCESSED_IMAGE_ELEM.setAttribute("height", height);

                streaming = true;
            }
        },
        false,
    );
}

function preprocess() {
    // load image into OpenCV
    let src = cv.imread(PHOTO_ELEM);

    // convert to grayscale
    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // otsu thresholding
    let binary = new cv.Mat();
    cv.threshold(gray, binary, 150, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

    // display the processed image
    cv.imshow(PROCESSED_ELEM, binary);

    // save image to image element
    let data = PROCESSED_ELEM.toDataURL("image/png");
    PROCESSED_IMAGE_ELEM.src = data;

    src.delete();
    gray.delete();

    return binary;
}

function getContours(binary) {
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

    hierarchy.delete();

    return contours;
}

function drawContours(contours, src) {
    for (let i = 0; i < contours.size(); ++i) {
        let color = new cv.Scalar(255, 0, 0);
        cv.drawContours(src, contours, i, color, 1, cv.LINE_8, hierarchy, 100);
    }
    return src;
}

function drawContour(contour, src) {
    let dst = new cv.Mat();
    cv.cvtColor(src, dst, cv.COLOR_GRAY2RGBA, 0);
    
    let color = new cv.Scalar(255, 0, 0, 255);
    let vec = new cv.MatVector();
    vec.push_back(contour);
    cv.drawContours(dst, vec, 0, color, 2, 8, new cv.Mat(), 0);
    return dst;
}

function getGridBounds(contours) {
    // find the largest four-sided contour
    let bounds;
    let maxArea = 0;
    for (let i = 0; i < contours.size(); ++i) {
        let perimeter = cv.arcLength(contours.get(i), true);
        let poly = new cv.Mat();
        cv.approxPolyDP(contours.get(i), poly, 0.02 * perimeter, true);
        if (poly.size().height == 4) {
            let area = cv.contourArea(poly);
            if (area > maxArea) {
                maxArea = area;
                bounds = poly;
            }
        }
    }
    return bounds;
}

function transform(src, bounds) {
    let dst = cv.Mat.zeros(src.rows, src.cols, src.type());
    let pts1 = cv.matFromArray(4, 1, cv.CV_32FC2, [bounds.data32S[0], bounds.data32S[1], bounds.data32S[2], bounds.data32S[3], bounds.data32S[4], bounds.data32S[5], bounds.data32S[6], bounds.data32S[7]]);
    let pts2 = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, src.cols, 0, src.cols, src.rows, 0, src.rows]);
    let M = cv.getPerspectiveTransform(pts1, pts2);
    cv.warpPerspective(src, dst, M, dst.size(), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    return dst;
}

function takeFrame() {
    CANVAS_ELEM.getContext("2d").drawImage(VIDEO_ELEM, 0, 0, width, height);
    let data = CANVAS_ELEM.toDataURL("image/png");
    let img = PHOTO_ELEM;
    img.src = data;
}

function cameraLoop() {
    takeFrame();
    PHOTO_ELEM.onload = () => {
        let binary = preprocess();
        let contours = getContours(binary);
        let bounds = getGridBounds(contours);
        let bounded_binary = drawContour(bounds, binary);
        cv.imshow(BOUNDED_PROCESSED_ELEM, bounded_binary);
        bounded_binary.delete();
        binary.delete();
        contours.delete();
    };
    //requestAnimationFrame(cameraLoop);
}

startup();
setInterval(cameraLoop, 50);