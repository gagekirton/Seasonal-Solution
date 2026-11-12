#!/bin/bash
# Demo-deploy helper: the GitHub repo does not carry the site's binary media
# (photos/videos), so the Docker build pulls them from the published static
# preview, which serves the identical files. Runs inside Dockerfile.demo
# before the app build; fails the build if any file is missing.
set -e

BASE="${MEDIA_BASE_URL:-https://curious-semolina-08dfa5.netlify.app}"

IMAGES="gallery-after.jpg gallery-before.jpg handyman.jpg hero.jpg og-share.jpg portrait-about.jpg service-eavestrough.jpg service-fall.jpg service-handyman.jpg service-lawn.jpg service-painting.jpg service-pressure.jpg service-renovation.jpg service-snow.jpg service-spring.jpg"
VIDEOS="hero-snow.mp4 lawn.mp4 promo.mp4"

mkdir -p client/public/images client/public/videos
for f in $IMAGES; do
  curl -fsSL --retry 3 -o "client/public/images/$f" "$BASE/images/$f"
  echo "fetched images/$f"
done
for f in $VIDEOS; do
  curl -fsSL --retry 3 -o "client/public/videos/$f" "$BASE/videos/$f"
  echo "fetched videos/$f"
done
echo "media fetch complete"
