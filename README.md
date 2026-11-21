# Theory Trainer

A single-user web app for learning and practising the **DVSA car (category B) theory test** in Great Britain. It works on a phone, installs to the home screen and works offline.

## What it covers

| Part | Official format | In the app |
|---|---|---|
| Multiple choice | 50 questions, 57 minutes, pass mark 43. Includes a 3-question case study (a video clip in the real test). | Timed mock with flag and review. 47 questions spread across the 14 DVSA topics, plus a written 3-question case study. |
| Hazard perception | 14 clips with 15 developing hazards, scored 0–5 each, pass mark 44/75. | Animated top-down clips with DVSA-style 5-band scoring windows and a check for constant or rhythmic clicking. |

- **Learning mode:** topic lessons, practice with instant feedback and Highway Code references, spaced repetition, and road sign flashcards.
- **Testing mode:** full mock test, topic tests, a weak-spots test and a full hazard perception mock.
- **Readiness:** a score with a "Ready to book" verdict. It needs your last 3 mocks at 45/50 or higher, every topic at 85% or higher, at least 90% of the bank seen, and your last 3 hazard perception mocks at 55/75 or higher.

**Road signs:** every sign in *The Highway Code – Traffic signs* booklet (164 images) is used in the flashcards and the sign questions. They were extracted with `scripts/extract-signs.py`, `scripts/segment-signs.py` and `scripts/extract-signs-rest.py`. © Crown copyright, used under the Open Government Licence v3.0.

The written questions are original. They are written from the Highway Code and *Know Your Traffic Signs* (Open Government Licence) and are not DVSA's licensed question bank.

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
