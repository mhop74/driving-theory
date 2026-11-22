# Theory Trainer

A single-user web app for learning and practising the **DVSA car (category B) theory test** in Great Britain. It works on a phone, installs to the home screen and works offline.

## What it covers

| Part | Official format | In the app |
|---|---|---|
| Multiple choice | 50 questions, 57 minutes, pass mark 43. Includes a 3-question case study (a video clip in the real test). | Timed mock with flag and review. 47 questions spread across the 14 DVSA topics, plus a written 3-question case study. |
| Hazard perception | 14 clips with 15 developing hazards, scored 0–5 each, pass mark 44/75. | First-person realistic 3D clips (three.js), with a 2D fallback. Clips with a `video` (marked **Unreal Engine** in the list) play a pre-rendered Unreal Engine 5 video instead, with the same timings and 3D scoring windows. Scoring uses DVSA-style 5-band windows and a check for constant or rhythmic clicking. 3D windows start when the hazard is first visible from the driver's seat (`scripts/probe-3d-windows.cjs`). |

- **Learning mode:** topic lessons, practice with instant feedback and Highway Code references, spaced repetition, and road sign flashcards.
- **Testing mode:** full mock test, topic tests, a weak-spots test and a full hazard perception mock.
- **Readiness:** a score with a "Ready to book" verdict. It needs your last 3 mocks at 45/50 or higher, every topic at 85% or higher, at least 90% of the bank seen, and your last 3 hazard perception mocks at 55/75 or higher.

**Road signs:** every sign in *The Highway Code – Traffic signs* booklet (164 images) is used in the flashcards and the sign questions. They were extracted with `scripts/extract-signs.py`, `scripts/segment-signs.py` and `scripts/extract-signs-rest.py`. © Crown copyright, used under the Open Government Licence v3.0.

The written questions are original. They are written from the Highway Code and *Know Your Traffic Signs* (Open Government Licence) and are not DVSA's licensed question bank.

## Unreal Engine videos

Some clips are rendered in Unreal Engine 5 from the same clip data and played as video (`public/videos/<id>.mp4`, set by the clip's `video` field in `src/data/clips.ts`). The renders keep the clip's timings and the driver's sight lines, so the 3D scoring windows in `src/data/windows3d.ts` still apply. If a video's hazard becomes visible at a different moment (for example a different vehicle), the clip's `video.windows` overrides them. Taps are timed from the video's own clock. If a video can't play (for example offline, since videos aren't cached by the service worker), the clip falls back to the 3D or 2D scene.

| Clip | Video |
|---|---|
| `ball` (Residential street) | `public/videos/ball.mp4`: 1080p, 30 fps, 22 s |
| `behind-bus` (Pedestrian behind a bus) | `public/videos/behind-bus.mp4`: 1080p, 30 fps, 22 s |
| `zebra` (Zebra crossing) | `public/videos/zebra.mp4`: 1080p, 30 fps, 23 s |
| `dog` (Dog on the pavement) | `public/videos/dog.mp4`: 1080p, 30 fps, 22 s |
| `emerge-left` (Side road on the left) | `public/videos/emerge-left.mp4`: 1080p, 30 fps, 22 s |
| `turn-across` (Oncoming car turns across you) | `public/videos/turn-across.mp4`: 1080p, 30 fps, 22 s, overcast sky |
| `walkers` (Walkers on a country lane) | `public/videos/walkers.mp4`: 1080p, 30 fps, 22 s, storm sky, rain and a wet road; walkers in bright waterproofs on your side, you pull out to pass (`passOut`) |
| `robot` (Delivery robot and parked van, replaces the cyclist) | `public/videos/robot.mp4`: 1080p, 30 fps, 24 s, sunny; semi-detached street, road-going delivery robot on the cyclist's path, box van at the kerb |
| `overtaker` (Country road overtaker) | `public/videos/overtaker.mp4`: 1080p, 30 fps, 22 s, sunny; country lane with bends, box truck as the lorry |
| `bus` (Bus at a bus stop) | `public/videos/bus.mp4`: 1080p, 30 fps, 24 s, overcast with light rain; semi-detached street, yellow bus, people in bright waterproofs |
| `door` (Parked car door opens) | `public/videos/door.mp4`: 1080p, 30 fps, 23 s, broken cloud; semi-detached street, orange Mercedes-AMG GT (Car Interaction pack) whose driver opens the door into the road |
| `reverse` (Car reversing from a driveway) | `public/videos/reverse.mp4`: 1080p, 30 fps, 22 s, overcast; detached brick houses (Buildings04) with driveways, Vehicle Variety Pack cars |
| `turn-right` (Car ahead turning right) | `public/videos/turn-right.mp4`: 1080p, 30 fps, 22 s |
| `double` (High street, two hazards) | `public/videos/double.mp4`: 1080p, 30 fps, 28 s |
| `tractor` (Vehicle from a field) | `public/videos/tractor.mp4`: 1080p, 30 fps, 26 s. A red pickup plays the tractor; scoring window 9.5–13.5 s (`video.windows`) |

## Deploying to GitHub Pages

1. In the repo, go to **Settings → Secrets and variables → Actions → New repository secret**. Create `APP_PASSWORD` with the password you want.
2. Go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Push to `main`, or run the "Deploy to GitHub Pages" workflow by hand. The site appears at `https://<user>.github.io/driving-theory/`.

To change the password, update the secret and re-run the workflow. This signs out any devices that were remembered.

**About the password:** it is a simple client-side gate. Only a salted SHA-256 hash is published, and the password itself never goes into the repo. It keeps casual visitors out, but it is not strong security.

**Where progress is saved:** in the browser's local storage on each device. Use Settings → Export backup to keep a copy or to move to a new phone.

## Development

```bash
npm install
npm run dev     # local password: letmein
npm test
npm run build
```

Question IDs are positional (`topic-index`). Only add new questions to the end of a topic's list, so saved progress still matches.
