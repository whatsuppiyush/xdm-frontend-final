# Dockerfile
FROM ghcr.io/puppeteer/puppeteer:23.11.1

# Install Python 3 and pip
USER root
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Create a symlink for python command
RUN ln -s /usr/bin/python3 /usr/bin/python

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json for better caching
COPY package*.json ./
RUN npm ci --only=production

# Copy Python requirements first (for better Docker layer caching)
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip3 install --no-cache-dir -r backend/requirements.txt

# Copy the Prisma schema folder
COPY prisma ./prisma

# Copy the entire backend folder to preserve structure
COPY backend/ ./backend/

# Copy the rest of your application
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the Next.js application
RUN npm run build

# Make Python scripts executable
RUN chmod +x backend/*.py

# Create necessary directories and set permissions
RUN mkdir -p /app/tmp && \
    chown -R pptruser:pptruser /app

# Switch back to the default non-root user
USER pptruser

# Expose the port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/healthz || exit 1

# Start the application
CMD ["npm", "start"]
