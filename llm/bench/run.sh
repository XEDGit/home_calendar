#!/bin/sh
# Benchmark one model: bench/run.sh <model.gguf> [ctx] [--think]
# Starts a throwaway llama.cpp Vulkan server on localhost:8089, runs bench.py.
set -e
MODEL=$1; CTX=${2:-12288}; shift; shift 2>/dev/null || true
DIR=$(cd "$(dirname "$0")/../.." && pwd)
NAME=llm-bench
docker rm -f $NAME >/dev/null 2>&1 || true
docker run -d --name $NAME --device /dev/dri -v home_calendar_models:/models:ro -p 127.0.0.1:8089:8080 \
	ghcr.io/ggml-org/llama.cpp:server-vulkan \
	-m "/models/$MODEL" --host 0.0.0.0 --port 8080 -ngl 99 -c "$CTX" --parallel 1 --jinja >/dev/null
until curl -sf localhost:8089/health >/dev/null; do
	docker ps -q -f name=$NAME | grep -q . || { docker logs $NAME 2>&1 | tail -20; exit 1; }
	sleep 2
done
docker logs $NAME 2>&1 | grep -E "Vulkan0 (model|KV|compute) buffer size" || true
python3 "$DIR/llm/bench/bench.py" http://localhost:8089 --out "$DIR/llm/bench/results-${MODEL%.gguf}$*.json" "$@"
docker rm -f $NAME >/dev/null
