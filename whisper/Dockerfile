# whisper.cpp server with Vulkan, built here because the upstream
# main-vulkan image targets newer CPUs (AVX-512) and dies with SIGILL on
# the Ryzen 3700X. AVX2/FMA/F16C is what this CPU has.
FROM ubuntu:24.04 AS build
ARG WHISPER_REF=v1.9.4
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential cmake git ca-certificates libvulkan-dev glslc spirv-headers \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch ${WHISPER_REF} https://github.com/ggml-org/whisper.cpp /src
RUN cmake -S /src -B /build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
        -DGGML_VULKAN=ON -DGGML_NATIVE=OFF -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON \
        -DWHISPER_BUILD_TESTS=OFF \
    && cmake --build /build -j4 --target whisper-server

FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends \
        libvulkan1 mesa-vulkan-drivers ffmpeg libgomp1 curl python3 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /build/bin/whisper-server /usr/local/bin/whisper-server
COPY ondemand.py /usr/local/bin/ondemand.py
# Proxy on :8080 that runs whisper-server only while in use (see ondemand.py)
ENTRYPOINT ["python3", "/usr/local/bin/ondemand.py"]
