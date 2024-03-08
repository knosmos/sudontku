// HTML elements
let VIDEO_ELEM = document.getElementById("camera-feed");
let CANVAS_ELEM = document.getElementById("camera-canvas");
let PHOTO_ELEM = document.getElementById("camera-image-raw");
let PROCESSED_ELEM = document.getElementById("camera-canvas-processed");
let PROCESSED_IMAGE_ELEM = document.getElementById("camera-image-processed");
let BOUNDED_PROCESSED_ELEM = document.getElementById("canvas-bounded-processed");
let TRANSFORMED_ELEM = document.getElementById("canvas-transformed");

let START_BUTTON = document.getElementById("start-button");
let CAPTURE_BUTTON = document.getElementById("capture-button");
let BACK_BUTTON = document.getElementById("back-button");

// Video parameters
let streaming = false;
let width;
let height;

// CV parameters
let cellsize = 50;

// Start the camera and set up the video feed; initialize the canvases and image elements
function startup() {
    video = VIDEO_ELEM;
    canvas = CANVAS_ELEM;

    console.log("Trying back camera");
    navigator.mediaDevices
        .getUserMedia({ video: {
            facingMode: {
                exact: "environment"
            }
        }, audio: false })
        .then((stream) => {
            video.srcObject = stream;
            video.play();
            console.log("Loaded back camera feed");
        })
        .catch((err) => {
            console.log("Front camera fallback");
            navigator.mediaDevices
                .getUserMedia({ video: true, audio: false })
                .then((stream) => {
                    video.setAttribute('autoplay', ''); // required for iOS
                    video.setAttribute('muted', '');
                    video.setAttribute('playsinline', '');
                    video.srcObject = stream;
                    video.play();
                    console.log("Loaded front camera feed");
                })
                .catch((err) => {
                    console.error(`An error occurred: ${err}`);
                });
            
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
    START_BUTTON.style.display = "none";
}

// take a frame from the video feed
function takeFrame() {
    CANVAS_ELEM.getContext("2d").drawImage(VIDEO_ELEM, 0, 0, width, height);
    let data = CANVAS_ELEM.toDataURL("image/png");
    let img = PHOTO_ELEM;
    img.src = data;
}

// Preprocess the image
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

// Get the contours of the binary image
function getContours(binary) {
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

    hierarchy.delete();

    return contours;
}

// Draw the contour on the image
function drawContour(contour, src) {
    let dst = new cv.Mat();
    cv.cvtColor(src, dst, cv.COLOR_GRAY2RGBA, 0);
    
    let color = new cv.Scalar(255, 0, 0, 255);
    let vec = new cv.MatVector();
    vec.push_back(contour);
    cv.drawContours(dst, vec, 0, color, 2, 8, new cv.Mat(), 0);
    return dst;
}

// find the largest square contour
function getGridBounds(contours) {
    let bounds;
    let maxArea = 0;
    let smoothing = 0.02; // smoothing factor
    let edge_tolerance = 0.2; // tolerance for edge ratio
    for (let i = 0; i < contours.size(); ++i) {
        let perimeter = cv.arcLength(contours.get(i), true);
        let poly = new cv.Mat();
        cv.approxPolyDP(contours.get(i), poly, smoothing * perimeter, true);
        let onEdge = false;
        if (poly.size().height == 4) { // check for four-sidedness
            // detect square (this avoids detecting the paper/computer's edges)
            let side_lengths = [];
            for (let j = 0; j < 4; ++j) {
                let x1 = poly.data32S[j * 2];
                let y1 = poly.data32S[j * 2 + 1];
                let x2 = poly.data32S[(j * 2 + 2) % 8];
                let y2 = poly.data32S[(j * 2 + 3) % 8];

                // if any point is on the edge, we reject the contour
                if (x1 == 0 || x1 == width - 1 || y1 == 0 || y1 == height - 1 || x2 == 0 || x2 == width - 1 || y2 == 0 || y2 == height - 1) {
                    onEdge = true;
                }

                let side = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                side_lengths.push(side);
            }

            if (onEdge) {
                continue;
            }
            
            // check for squareness
            let min_side = Math.min(...side_lengths);
            let max_side = Math.max(...side_lengths);
            let ratio = min_side / max_side;
            if (ratio < 1 + edge_tolerance && ratio > 1 - edge_tolerance) {
                let area = cv.contourArea(poly); // check for largest area
                if (area > maxArea) {
                    maxArea = area;
                    bounds = poly;
                }
            }
        }
    }
    return bounds;
}

// perspective transformation
function transform(src, bounds) {
    let dst = cv.Mat.zeros(cellsize * 9, cellsize * 9, src.type());

    // find and order corners
    let corners = [];
    for (let i = 0; i < 4; ++i) {
        corners.push([bounds.data32S[i * 2], bounds.data32S[i * 2 + 1]]);
    }
    corners.sort((a, b) => a[0] - b[0]);
    let left = corners.slice(0, 2);
    let right = corners.slice(2, 4);
    left.sort((a, b) => a[1] - b[1]);
    right.sort((a, b) => a[1] - b[1]);

    // build transformation matrix
    let pts1 = cv.matFromArray(4, 1, cv.CV_32FC2, [right[0][0], right[0][1], right[1][0], right[1][1], left[1][0], left[1][1], left[0][0], left[0][1]]);
    let pts2 = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, 0, cellsize * 9, cellsize * 9, cellsize * 9, cellsize * 9, 0]);
    let M = cv.getPerspectiveTransform(pts1, pts2);
    cv.warpPerspective(src, dst, M, dst.size(), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

    // generate final image
    let flipped = new cv.Mat();
    cv.flip(dst, flipped, 1);
    dst.delete();

    return flipped;
}

// detect digits
function detectDigits(src) {
    let digits = [];
    for (let i = 0; i < 9; ++i) {
        for (let j = 0; j < 9; ++j) {
            let cell = src.roi(new cv.Rect(i * cellsize, j * cellsize, cellsize, cellsize)); // split the image into 81 cells
            digits.push(detectDigit(cell));
        }
    }
    console.log(digits);
    return digits;
}

// detect single digit from cell slice
function detectDigit(src) {
    scores = [];
    for (let i=1; i<10; i++) {
        let digit = cv.imread(document.getElementById(`digit-${i}`));
        let result = new cv.Mat();

        let digit_cvt = new cv.Mat();
        cv.cvtColor(digit, digit_cvt, cv.COLOR_RGBA2GRAY, 0);
        digit.delete();

        cv.matchTemplate(src, digit_cvt, result, cv.TM_CCOEFF_NORMED, new cv.Mat());

        let minMax = cv.minMaxLoc(result);
        let avg = minMax.maxVal;

        result.delete();
        digit_cvt.delete();

        scores.push(avg);
    }
    console.log(scores);
    if (Math.max(...scores) < 0.2) {
        return 0;
    }
    return scores.indexOf(Math.max(...scores)) + 1;
}

// draw the digits on the image
function drawDigits(src, digits, original) {
    let font = cv.FONT_HERSHEY_SIMPLEX;
    let color = new cv.Scalar(0, 48, 99, 255);
    let color2 = new cv.Scalar(252, 157, 3, 255);
    for (let i = 0; i < 9; ++i) {
        for (let j = 0; j < 9; ++j) {
            let digit = digits[i * 9 + j];
            let c;
            if (original[i * 9 + j] != 0) {
                c = color2;
            } else {
                c = color;
            }
            cv.putText(src, digit.toString(), new cv.Point(i * cellsize + 10, j * cellsize + 40), font, 1, c, 2, cv.LINE_AA, false);
        }
    }
}

// sudoku solving (backtracker)
function solve(board) {
    // console.log(board);
    let i = 0;
    while (i < 81) {
        if (board[i] == 0) {
            for (let j = 1; j <= 9; j++) {
                if (isValid(board, i, j)) {
                    board[i] = j;
                    let res = solve(board);
                    if (res != false) {
                        return res;
                    }
                }
            }
            board[i] = 0;
            return false;
        }
        i++;
    }
}

function isValid(board, i, j) {
    let row = Math.floor(i / 9);
    let col = i % 9;
    for (let k = 0; k < 9; k++) {
        if (board[row * 9 + k] == j || board[k * 9 + col] == j) {
            return false;
        }
    }
    let startRow = Math.floor(row / 3) * 3;
    let startCol = Math.floor(col / 3) * 3;
    for (let k = startRow; k < startRow + 3; k++) {
        for (let l = startCol; l < startCol + 3; l++) {
            if (board[k * 9 + l] == j) {
                return false;
            }
        }
    }
    return true;
}

// main loop
let binary;
let bounds;

function cameraLoop() {
    takeFrame();
    PHOTO_ELEM.onload = () => {
        binary = preprocess();
        contours = getContours(binary);
        bounds = getGridBounds(contours);
        
        let bounded_binary = drawContour(bounds, binary);
        cv.imshow(BOUNDED_PROCESSED_ELEM, bounded_binary);

        bounded_binary.delete();
        binary.delete();
        bounds.delete();
        contours.delete();
    };
}

let board;
function runCapture() {
    alert("capturing!");

    // image processing
    binary = preprocess();
    contours = getContours(binary);
    bounds = getGridBounds(contours);

    // solution extraction
    let transformed = transform(binary, bounds);
    transformed_rgb = new cv.Mat();
    cv.cvtColor(transformed, transformed_rgb, cv.COLOR_RGBA2RGB, 0);
    board = detectDigits(transformed);
    let original = [...board];
    solve(board);
    drawDigits(transformed_rgb, board, original);

    cv.imshow(TRANSFORMED_ELEM, transformed_rgb);

    transformed.delete();
    transformed_rgb.delete();
    binary.delete();
    bounds.delete();

    // fancy displaying
    BOUNDED_PROCESSED_ELEM.style.bottom = "100vh";
    BOUNDED_PROCESSED_ELEM.style.top = "-100vh";
    CAPTURE_BUTTON.style.bottom = "100vh";
    
    TRANSFORMED_ELEM.style.bottom = "0px";
    TRANSFORMED_ELEM.style.top = "0";
    BACK_BUTTON.style.bottom = "10px";
}

START_BUTTON.onclick = startup;
setInterval(cameraLoop, cellsize);
CAPTURE_BUTTON.onclick = runCapture;
BACK_BUTTON.onclick = () => {
    BOUNDED_PROCESSED_ELEM.style.bottom = "0px";
    BOUNDED_PROCESSED_ELEM.style.top = "0";
    CAPTURE_BUTTON.style.bottom = "10px";
    
    TRANSFORMED_ELEM.style.bottom = "-100vh";
    TRANSFORMED_ELEM.style.top = "100vh";
    BACK_BUTTON.style.bottom = "-100vh";
}