FROM node:20-slim

# Install FFmpeg, Python (for yt-dlp), and essential build tools
RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-pip ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the Next.js application
RUN npm run build

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
