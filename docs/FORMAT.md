# Drone show file format, version 1

One file per drone. `drone_NN.bin` is what the ESP32 loads; `drone_NN.txt` holds exactly the same numbers in readable form.

## Coordinates
Metres. x runs left to right as the audience sees it, y points away from the audience, z points up. The origin is the centre of the flight-area floor. Drone N takes off from takeoff pad N (see takeoff_layout.csv).

## .bin layout (little-endian)
| Offset | Type | Field |
|---|---|---|
| 0 | 4 × char | Magic "DSHW" |
| 4 | uint16 | Format version (1) |
| 6 | uint16 | Drone number (1-based, matches the designer) |
| 8 | uint32 | Show ID (changes whenever the show changes) |
| 12 | uint32 | Piece count (P) |
| 16 | uint32 | LED event count (E) |
| 20 | float32 | Show length in seconds |
| 24 | uint32 | CRC-32 (IEEE) of the whole file, computed with these 4 bytes set to zero |
| 28 | uint32 | Reserved (0) |
| 32 | P × 132 bytes | Trajectory pieces |
| 32 + 132·P | E × 12 bytes | LED events |

File size must equal 32 + 132·P + 12·E.

### Trajectory piece (132 bytes = 33 float32)
duration (s), then x c0..c7, y c0..c7, z c0..c7, yaw c0..c7 (radians; always 0 in version 1).
Pieces play back to back from t = 0. Inside a piece, with t = seconds since that piece started:
position = c0 + c1·t + c2·t² + … + c7·t⁷. Evaluate with Horner's method. Velocity and acceleration are the first and second derivatives.
Neighbouring pieces meet with the same position, velocity and acceleration.

### LED event (12 bytes)
float32 start_s, float32 fade_s, uint8 r, uint8 g, uint8 b, uint8 reserved (0).
From start_s, fade linearly from the current colour to (r, g, b) over fade_s seconds, then hold until the next event. Events are in time order; the first is at 0 s.

## Checks the drone should run on upload
Magic is "DSHW"; version is supported; drone number matches its own; file size matches the counts; CRC-32 matches; every duration is positive; the first position is within a few centimetres of its takeoff pad.
