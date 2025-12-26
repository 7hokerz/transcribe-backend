# -------------------------------------------------
# Stage 1: Build Node.js application
# -------------------------------------------------
FROM node:24.12.0-slim AS app-builder
WORKDIR /app

# Install dependencies first to leverage Docker layer caching
COPY package*.json ./
RUN npm install

# Copy the rest of the application source code and build
COPY . .
RUN npm run build
RUN npm prune --production

# -------------------------------------------------
# Stage 2: Build ffprobe with essential protocols and formats
# -------------------------------------------------
FROM debian:bookworm-20251208-slim AS ffmpeg-builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    yasm \
    curl \
    ca-certificates \
    xz-utils \
    gnupg \
    dirmngr \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Download and extract the desired FFmpeg version (e.g., 7.0)
WORKDIR /src
RUN curl -fsSLo ffmpeg.tar.xz \
            --retry 3 --retry-delay 5 \
            https://ffmpeg.org/releases/ffmpeg-7.0.tar.xz \
    && curl -fsSLo ffmpeg.tar.xz.asc \
            --retry 3 --retry-delay 5 \
            https://ffmpeg.org/releases/ffmpeg-7.0.tar.xz.asc \
    && curl -fsSL \
            --retry 3 --retry-delay 5 \
            https://ffmpeg.org/ffmpeg-devel.asc \
        | gpg --import \
    && gpg --batch --verify ffmpeg.tar.xz.asc ffmpeg.tar.xz \
    && tar xJf ffmpeg.tar.xz --strip-components=1 \
    && rm -f ffmpeg.tar.xz ffmpeg.tar.xz.asc

# Configure with essential protocols and formats for stdin processing
RUN ./configure \
    --disable-programs \
    --enable-ffprobe \
    --disable-doc \
    --disable-debug \
    --enable-small \
    \
    --disable-everything \
    \
    --enable-protocol=pipe \
    --enable-protocol=fd \
    --enable-protocol=data \
    --enable-protocol=file \
    \
    --enable-demuxer=aac \
    --enable-demuxer=mp3 \
    --enable-demuxer=wav \
    --enable-demuxer=flac \
    --enable-demuxer=ogg \
    --enable-demuxer=m4a \
    --enable-demuxer=mov \
    --enable-demuxer=mp4 \
    --enable-demuxer=matroska \
    --enable-demuxer=webm \
    \
    --enable-decoder=aac \
    --enable-decoder=mp3 \
    --enable-decoder=pcm_s16le \
    --enable-decoder=pcm_s24le \
    --enable-decoder=pcm_s32le \
    --enable-decoder=pcm_f32le \
    --enable-decoder=flac \
    \
    --enable-parser=aac \
    --enable-parser=mp3 \
    --enable-parser=flac \
    \
    && make -j$(nproc) \
    && strip ffprobe

# Verify the built ffprobe supports pipe protocol
RUN echo "test" | ./ffprobe -v error -f lavfi -i "anullsrc=duration=1:sample_rate=48000:channel_layout=stereo" -hide_banner || echo "Basic test completed"

# -------------------------------------------------
# Stage 3: Final runtime image
# -------------------------------------------------
FROM node:24.12.0-slim

ENV NODE_ENV=production

WORKDIR /app

# Copy the ffprobe binary from the ffmpeg-builder stage
COPY --from=ffmpeg-builder /src/ffprobe /usr/local/bin/ffprobe

# Set execute permissions
RUN chmod +x /usr/local/bin/ffprobe

# Verify ffprobe works and supports pipe protocol
RUN /usr/local/bin/ffprobe -version
RUN /usr/local/bin/ffprobe -protocols | grep -E "(pipe|fd)" || echo "Checking available protocols"

# Copy production dependencies and the built application from the app-builder stage
COPY --from=app-builder --chown=node:node /app/package*.json ./
COPY --from=app-builder --chown=node:node /app/node_modules ./node_modules
COPY --from=app-builder --chown=node:node /app/dist ./dist

USER node
EXPOSE 8080

# Set the command to run the application
CMD ["node", "dist/server.js"]