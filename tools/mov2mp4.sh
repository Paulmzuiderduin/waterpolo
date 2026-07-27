#!/usr/bin/env bash
set -euo pipefail

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is not installed."
  echo "Install it with: brew install ffmpeg"
  exit 1
fi

if [ "$#" -lt 1 ]; then
  echo "Usage: $(basename "$0") <file-or-folder> [more files/folders...]"
  exit 1
fi

to_abs() {
  local p="$1"
  if [ -d "$p" ]; then
    (cd "$p" && pwd)
  else
    (cd "$(dirname "$p")" && printf "%s/%s\n" "$(pwd)" "$(basename "$p")")
  fi
}

next_output_path() {
  local base="$1"
  local ext="$2"
  local candidate="${base}.${ext}"
  local i=1
  while [ -e "$candidate" ]; do
    candidate="${base}-${i}.${ext}"
    i=$((i + 1))
  done
  printf "%s\n" "$candidate"
}

convert_file() {
  local input="$1"
  local dir name stem output
  dir="$(dirname "$input")"
  name="$(basename "$input")"
  stem="${name%.*}"
  output="$(next_output_path "${dir}/${stem}" "mp4")"

  echo "Converting:"
  echo "  in : $input"
  echo "  out: $output"

  ffmpeg -hide_banner -loglevel error -stats -i "$input" \
    -map 0:v:0 -map 0:a? \
    -c:v libx264 -preset medium -crf 20 \
    -c:a aac -b:a 192k \
    -movflags +faststart \
    "$output"
}

convert_path() {
  local target="$1"
  if [ -d "$target" ]; then
    while IFS= read -r -d '' file; do
      convert_file "$file"
    done < <(find "$target" -type f \( -iname "*.mov" -o -iname "*.MOV" \) -print0)
  elif [ -f "$target" ]; then
    convert_file "$target"
  else
    echo "Skipping missing path: $target"
  fi
}

for raw in "$@"; do
  convert_path "$(to_abs "$raw")"
done
