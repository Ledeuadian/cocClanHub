# Intro video

Drop your intro video here as `intro.mp4` (a `.webm` fallback is recommended too).

The `ScrollVideoIntro` component looks for `/videos/intro.mp4`.

Recommended spec:
- **Resolution**: 1280×720 (16:9) or 1920×1080
- **Duration**: 6–15 seconds (longer = more scroll required)
- **Codec**: H.264 `.mp4` for widest device support
- **Audio**: either strip audio and use `muted` (current setup), or remove `muted` from the component
- **File size**: keep under ~5 MB for fast first paint
