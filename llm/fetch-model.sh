#!/bin/sh
# Download a model file from Hugging Face into the models volume and verify
# its sha256 against the repo's LFS metadata.
#   llm/fetch-model.sh <hf-repo> <file> [name-in-volume]
#   llm/fetch-model.sh unsloth/Qwen3.5-4B-GGUF Qwen3.5-4B-Q4_K_M.gguf
#   llm/fetch-model.sh ggerganov/whisper.cpp ggml-large-v3-turbo-q5_0.bin whisper-ggml-large-v3-turbo-q5_0.bin
set -e
[ -n "$2" ] || { sed -n 2,6p "$0"; exit 1; }
exec docker run --rm --user 0 -v home_calendar_models:/models --entrypoint sh curlimages/curl:latest -c '
set -e
repo=$1; file=$2; dest=${3:-$2}
want=$(curl -s "https://huggingface.co/api/models/$repo/tree/main" | sed "s/},{/}\n{/g" | grep "\"path\":\"$file\"" | sed -E "s/.*\"oid\":\"([0-9a-f]{64})\".*/\1/")
[ -n "$want" ] || { echo "no $file in $repo"; exit 1; }
if [ -f "/models/$dest" ] && [ "$(sha256sum "/models/$dest" | cut -c1-64)" = "$want" ]; then echo "OK (already there) $dest"; exit 0; fi
curl -sSL --retry 3 -o "/models/$dest.part" "https://huggingface.co/$repo/resolve/main/$file"
if [ "$(sha256sum "/models/$dest.part" | cut -c1-64)" = "$want" ]; then mv "/models/$dest.part" "/models/$dest"; echo "OK $dest"
else rm -f "/models/$dest.part"; echo "checksum mismatch for $dest"; exit 1; fi
' sh "$@"
