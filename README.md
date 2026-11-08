# Full-scale spool test figure

Interactive isometric figure of the full-scale fatigue test of a 30 in spiral-welded X70 spool (M.Sc. thesis, Chapter 4).

**Live figure:** https://fahimalr.github.io/spool-test-figure/

- `index.html`: the standalone interactive page. Open it in a browser. Hover to scrub cycles; keys 1 to 6 select a notch.
- `figure.png`: labelled still for slides (3x resolution).
- `build.mjs`: the script that draws the figure.

## Test modelled

- Spool: 30 in OD, 0.441 in wall, 192 in between welded 2:1 end caps; spiral seam at 50.8 degrees to the axis.
- Loading: water pressure cycled between 206 and 1,482 psi (R = 0.139).
- Six EDM notches at the seam weld toe, each with a clip gauge.
- Notch 1 broke through at 11,951 cycles; the records of Notches 1 and 6 end there. The test continued to about 37,000 cycles.

The raw clip-gauge records are not included in this repository.

## Credits

Drawn with the Anatomy drawing kit (github.com/wheresryan22/anatomy, MIT licence).

Fahim Al-Rashid Chowdhury, M.Sc. Mechanical Engineering, University of Alberta. Research with Enbridge and DNV; test run by Acuren.
