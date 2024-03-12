# su-don't-ku
Lightweight realtime mobile-based computer vision Sudoku solver

<img src=https://github.com/knosmos/sudontku/assets/30610197/98b3c43f-e0bd-4cd1-981c-8b0eb022ff97 width=50%>

Deployed at [https://knosmos.github.io/sudontku/](https://knosmos.github.io/sudontku/)

## How does it work?
Starting with the raw camera feed, Otsu's adaptive thresholding gives us a binary black-and-white image. After some more preprocessing to clean up the image, we run contour detection and polygon approximation to find candidate board boundary points. We look for the largest square-shaped contour (four edges that are roughly equal in length), and run a homography to correct the perspective distortion. From here, we can split the board into its 81 cells and individually run digit recognition on each of them; this is implemented with template matching. The last step is the easiest: a backtracking algorithm takes the detected board and solves the Sudoku.

## Why?
My friend is too good at Sudoku. She beat me ten times in a row, so I figured I would try to level the playing field :)

## Roadmap
- [x] Camera image capture
- [x] Image preprocessing
- [x] Board detection and perspective transformation
- [x] Template-matching digit recognition
- [x] Sudoku solver
- [x] Clean UI
- [ ] Image upload
- [ ] Board detection confidence and prompting for manual corner selection
